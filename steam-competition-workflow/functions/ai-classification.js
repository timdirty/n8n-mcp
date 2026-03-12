/**
 * AI 分類與摘要生成
 * 使用 OpenAI GPT-4o-mini
 */

/**
 * STEAM 分類系統提示詞
 */
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

/**
 * 摘要生成系統提示詞
 */
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

/**
 * 呼叫 OpenAI API 進行分類
 */
async function classifyCompetition(competitionData) {
  const userPrompt = `請分類以下教育比賽資訊：

**標題：** ${competitionData.title}

**描述：** ${competitionData.description || competitionData.content}

**來源：** ${competitionData.source || '未知'}

**日期：** ${competitionData.publishDate || competitionData.date || '未知'}`;

  // 在 n8n 中，OpenAI 節點會自動處理 API 呼叫
  // 這裡提供配置參考
  return {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: CLASSIFICATION_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    temperature: 0.3,  // 較低的溫度以獲得更一致的分類
    response_format: { type: 'json_object' }
  };
}

/**
 * 呼叫 OpenAI API 生成摘要
 */
async function generateSummary(competitionData, classification) {
  const userPrompt = `請為以下教育比賽資訊生成摘要：

**標題：** ${competitionData.title}

**描述：** ${competitionData.description || competitionData.content}

**分類：** ${classification.categories.join(', ')}

**來源：** ${competitionData.source || '未知'}

**日期：** ${competitionData.publishDate || competitionData.date || '未知'}

**網址：** ${competitionData.url || '未提供'}`;

  return {
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: SUMMARY_SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: userPrompt
      }
    ],
    temperature: 0.7,  // 較高的溫度以獲得更有創意的摘要
    response_format: { type: 'json_object' }
  };
}

/**
 * n8n Function 節點主函式
 * 整合分類和摘要生成
 */
const items = $input.all();
const results = [];

for (const item of items) {
  const competitionData = item.json;
  
  // 步驟 1：分類（這會在 OpenAI 節點中執行）
  const classificationConfig = classifyCompetition(competitionData);
  
  // 步驟 2：生成摘要（這會在另一個 OpenAI 節點中執行）
  // 注意：在實際 n8n 工作流程中，這兩個步驟會分別在不同的 OpenAI 節點中執行
  
  results.push({
    json: {
      ...competitionData,
      aiProcessing: {
        classificationConfig,
        timestamp: new Date().toISOString()
      }
    }
  });
}

return results;
