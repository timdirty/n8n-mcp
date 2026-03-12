import { logger } from './logger.js';

export interface AiConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

export interface AiResult {
  categories: string;
  primary: string;
  confidence: number;
  summary: string;
  keyPoints: string;
  callToAction: string;
}

const CLASSIFICATION_SYSTEM_PROMPT = `你是一位專業的 STEAM 教育專家。你的任務是將教育比賽資訊分類到以下類別：

**STEAM 分類標準：**
- **S (Science 科學)**：物理、化學、生物、地球科學、環境科學等自然科學相關
- **T (Technology 技術)**：程式設計、資訊科技、網路技術、軟體開發、AI/ML 等
- **E (Engineering 工程)**：機械、電子、土木、航太、機器人、創客等工程相關
- **A (Arts 藝術)**：視覺藝術、音樂、設計、表演藝術、數位藝術等
- **M (Mathematics 數學)**：數學競賽、數學建模、統計、邏輯推理等

**分類規則：**
1. 一個比賽可以屬於多個類別（多標籤分類）
2. 至少選擇一個主要類別
3. 如果比賽涵蓋多個領域，列出所有相關類別
4. 按重要性排序類別

**輸出格式（JSON）：**
{
  "categories": ["T", "E"],  // 主要類別列表，按重要性排序
  "primary": "T",            // 主要類別
  "confidence": 0.95,        // 信心分數 (0-1)
  "reasoning": "這是一個程式設計競賽，涉及軟體開發和演算法設計，主要屬於技術(T)類別。同時也涉及系統設計，因此也包含工程(E)元素。"
}`;

const SUMMARY_SYSTEM_PROMPT = `你是一位專業的教育資訊編輯。你的任務是為 STEAM 教育比賽資訊生成簡潔、吸引人的摘要。

**摘要要求：**
1. 長度：100-150 字（繁體中文）
2. 必須包含：
   - 比賽名稱
   - 主要內容/主題
   - 參賽對象（年齡/年級）
   - 重要日期（報名截止、比賽日期）
   - 獎項/獎金（如有）
3. 語氣：專業但友善，激勵參與
4. 格式：單一段落，易於閱讀

**輸出格式（JSON）：**
{
  "summary": "【2024 全國程式設計競賽】針對國高中生的程式設計挑戰賽，主題為「智慧城市解決方案」。參賽者需組隊開發創新應用，展現程式設計與問題解決能力。報名截止：3/31，決賽：5/15。優勝隊伍可獲得獎金 5 萬元及國際交流機會。",
  "keyPoints": [
    "對象：國高中生",
    "主題：智慧城市",
    "報名截止：3/31",
    "獎金：5 萬元"
  ],
  "callToAction": "立即組隊報名，展現你的程式設計實力！"
}`;

interface ClassificationResponse {
  categories: string[];
  primary: string;
  confidence: number;
  reasoning?: string;
}

interface SummaryResponse {
  summary: string;
  keyPoints: string[];
  callToAction: string;
}

async function callOpenAI(
  config: AiConfig,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      logger.error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`,
        'ai-classifier',
      );
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      logger.error('OpenAI returned empty content', 'ai-classifier');
      return null;
    }

    return JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      logger.error(`OpenAI request timed out after ${config.timeoutMs}ms`, 'ai-classifier');
    } else {
      logger.error(`OpenAI request failed: ${err}`, 'ai-classifier');
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Classify a competition item into STEAM categories and generate a summary.
 *
 * Makes two sequential OpenAI API calls:
 * 1. Classification (temperature 0.3)
 * 2. Summary generation using classification result (temperature 0.7)
 *
 * Returns null if either API call fails.
 */
export async function classifyAndSummarize(
  item: { title: string; description: string | null; source: string; url: string | null },
  config: AiConfig,
): Promise<AiResult | null> {
  // Step 1: Classification
  const classificationPrompt = `請分類以下教育比賽資訊：

**標題：** ${item.title}

**描述：** ${item.description || '無描述'}

**來源：** ${item.source || '未知'}`;

  const classificationRaw = await callOpenAI(
    config,
    CLASSIFICATION_SYSTEM_PROMPT,
    classificationPrompt,
    0.3,
  );

  if (!classificationRaw) {
    logger.warn(`Classification failed for: ${item.title}`);
    return null;
  }

  const classification: ClassificationResponse = {
    categories: Array.isArray(classificationRaw.categories)
      ? (classificationRaw.categories as string[])
      : [],
    primary: (classificationRaw.primary as string) || '',
    confidence: typeof classificationRaw.confidence === 'number' ? classificationRaw.confidence : 0,
  };

  // Step 2: Summary generation
  const summaryPrompt = `請為以下教育比賽資訊生成摘要：

**標題：** ${item.title}

**描述：** ${item.description || '無描述'}

**分類：** ${classification.categories.join(', ')}

**來源：** ${item.source || '未知'}

**網址：** ${item.url || '未提供'}`;

  const summaryRaw = await callOpenAI(config, SUMMARY_SYSTEM_PROMPT, summaryPrompt, 0.7);

  if (!summaryRaw) {
    logger.warn(`Summary generation failed for: ${item.title}`);
    return null;
  }

  const summaryResult: SummaryResponse = {
    summary: (summaryRaw.summary as string) || '',
    keyPoints: Array.isArray(summaryRaw.keyPoints) ? (summaryRaw.keyPoints as string[]) : [],
    callToAction: (summaryRaw.callToAction as string) || '',
  };

  return {
    categories: classification.categories.join(','),
    primary: classification.primary,
    confidence: classification.confidence,
    summary: summaryResult.summary,
    keyPoints: JSON.stringify(summaryResult.keyPoints),
    callToAction: summaryResult.callToAction,
  };
}
