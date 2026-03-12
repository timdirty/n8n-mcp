/**
 * 資料標準化處理模組
 * 用於將不同資料源的原始資料轉換為統一的標準格式
 */

const crypto = require('crypto');

/**
 * 主要標準化函數
 * @param {Array} items - 輸入資料陣列
 * @returns {Array} 標準化後的資料陣列
 */
function normalizeData(items) {
  const standardizedData = [];
  const seenHashes = new Set();

  for (const item of items) {
    try {
      const rawData = item.json;
      const source = rawData.source || 'unknown';
      
      // 根據資料源類型進行標準化
      let normalized;
      switch(source) {
        case 'rss':
          normalized = normalizeRSSData(rawData);
          break;
        case 'gov_api':
          normalized = normalizeGovAPIData(rawData);
          break;
        case 'most_web':
          normalized = normalizeMOSTWebData(rawData);
          break;
        case 'ntsec_api':
          normalized = normalizeNTSECAPIData(rawData);
          break;
        default:
          normalized = normalizeGenericData(rawData);
      }
      
      // 添加通用欄位
      normalized.id = generateId(normalized.title, normalized.organizer);
      normalized.hash_key = generateHashKey(normalized.title, normalized.organizer);
      normalized.category = categorizeSTEAM(normalized.title, normalized.description);
      normalized.target_audience = extractTargetAudience(normalized.description);
      normalized.registration_end = extractDate(normalized.description, 'deadline');
      normalized.competition_date = extractDate(normalized.description, 'event');
      normalized.location = extractLocation(normalized.description);
      normalized.contact = extractContact(normalized.description);
      normalized.prize = extractPrize(normalized.description);
      normalized.fee = extractFee(normalized.description);
      normalized.status = determineStatus(normalized);
      normalized.scraped_at = new Date().toISOString();
      normalized.sent_to_line = false;
      normalized.sent_at = null;
      
      // 基本驗證和去重
      if (isValidCompetition(normalized) && !seenHashes.has(normalized.hash_key)) {
        seenHashes.add(normalized.hash_key);
        standardizedData.push(normalized);
      }
    } catch (error) {
      console.error('資料標準化錯誤:', error.message);
      // 繼續處理下一筆資料
    }
  }
  
  return standardizedData.map(item => ({ json: item }));
}

/**
 * 標準化 RSS 資料
 */
function normalizeRSSData(rawData) {
  return {
    title: cleanTitle(rawData.title || rawData.name || ''),
    organizer: extractOrganizer(rawData.description || rawData.content || ''),
    description: cleanDescription(rawData.description || rawData.content || ''),
    url: rawData.link || rawData.url || '',
    source: '教育部RSS'
  };
}

/**
 * 標準化政府開放資料
 */
function normalizeGovAPIData(rawData) {
  return {
    title: cleanTitle(rawData.title || rawData.name || ''),
    organizer: rawData.organization || rawData.publisher || '政府單位',
    description: cleanDescription(rawData.notes || rawData.description || ''),
    url: rawData.resources?.[0]?.url || rawData.url || '',
    source: '政府開放資料'
  };
}

/**
 * 標準化科技部網站資料
 */
function normalizeMOSTWebData(rawData) {
  return {
    title: cleanTitle(rawData.title || ''),
    organizer: '科技部',
    description: cleanDescription(rawData.content || rawData.description || ''),
    url: rawData.link || rawData.url || '',
    source: '科技部網站'
  };
}

/**
 * 標準化科教館 API 資料
 */
function normalizeNTSECAPIData(rawData) {
  return {
    title: cleanTitle(rawData.title || rawData.eventName || ''),
    organizer: rawData.organizer || '國立臺灣科學教育館',
    description: cleanDescription(rawData.description || rawData.content || ''),
    url: rawData.url || rawData.link || '',
    location: rawData.location || rawData.venue || '台北市立科學教育館',
    registration_start: rawData.registrationStart || null,
    registration_end: rawData.registrationEnd || null,
    competition_date: rawData.eventDate || null,
    fee: rawData.fee || '請洽主辦單位',
    source: '科教館API'
  };
}

/**
 * 標準化通用資料
 */
function normalizeGenericData(rawData) {
  return {
    title: cleanTitle(rawData.title || rawData.name || ''),
    organizer: rawData.organizer || rawData.host || '未知主辦單位',
    description: cleanDescription(rawData.description || rawData.content || ''),
    url: rawData.url || rawData.link || '',
    source: rawData.source || '其他來源'
  };
}

/**
 * 生成唯一 ID
 */
function generateId(title, organizer) {
  const hash = crypto.createHash('md5');
  const year = new Date().getFullYear();
  hash.update(`${title}-${organizer}-${year}`);
  return `steam_${year}_${hash.digest('hex').substring(0, 8)}`;
}

/**
 * 生成去重用的 Hash Key
 */
function generateHashKey(title, organizer) {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w\u4e00-\u9fff]/g, '');
  const normalizedOrganizer = organizer
    .toLowerCase()
    .replace(/\s+/g, '');
  const year = new Date().getFullYear();
  const hashInput = `${normalizedTitle}-${normalizedOrganizer}-${year}`;
  
  const hash = crypto.createHash('md5');
  hash.update(hashInput, 'utf8');
  return hash.digest('hex').substring(0, 12);
}

/**
 * STEAM 分類
 */
function categorizeSTEAM(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
  const categories = {
    'Science': [
      '科學', '實驗', '研究', '生物', '化學', '物理', '自然',
      'science', 'biology', 'chemistry', 'physics', 'experiment'
    ],
    'Technology': [
      '程式', '資訊', '科技', '軟體', '網路', 'AI', '人工智慧',
      'programming', 'coding', 'software', 'technology', 'computer'
    ],
    'Engineering': [
      '工程', '機械', '建築', '設計', '製造', '機器人',
      'engineering', 'mechanical', 'robot', 'design', 'maker'
    ],
    'Arts': [
      '藝術', '美術', '創意', '設計', '音樂', '表演',
      'arts', 'creative', 'design', 'music', 'art'
    ],
    'Math': [
      '數學', '統計', '邏輯', '運算', '幾何',
      'math', 'mathematics', 'statistics', 'logic', 'geometry'
    ]
  };
  
  // 計算每個類別的匹配分數
  const scores = {};
  for (const [category, keywords] of Object.entries(categories)) {
    scores[category] = keywords.filter(keyword => text.includes(keyword)).length;
  }
  
  // 找出最高分的類別
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'Mixed';
  
  const topCategory = Object.keys(scores).find(cat => scores[cat] === maxScore);
  
  // 如果有多個類別分數相同，返回 Mixed
  const topCategories = Object.keys(scores).filter(cat => scores[cat] === maxScore);
  return topCategories.length > 1 ? 'Mixed' : topCategory;
}

/**
 * 提取目標對象
 */
function extractTargetAudience(description) {
  const text = description.toLowerCase();
  
  const audiences = {
    '國小': ['國小', '小學', '國民小學', 'elementary', '低年級', '中年級', '高年級'],
    '國中': ['國中', '中學', '國民中學', 'junior', '七年級', '八年級', '九年級'],
    '高中': ['高中', '高職', '高級中學', 'senior', '十年級', '十一年級', '十二年級'],
    '大學': ['大學', '大專', '大專院校', 'university', 'college', '研究所']
  };
  
  for (const [audience, keywords] of Object.entries(audiences)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return audience;
    }
  }
  
  return '全年齡';
}

/**
 * 提取日期
 */
function extractDate(description, type) {
  // 多種日期格式的正則表達式
  const datePatterns = [
    /(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})[日]?/g,
    /(\d{1,2})[月\-\/](\d{1,2})[日]?/g,
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/g
  ];
  
  for (const pattern of datePatterns) {
    const matches = [...description.matchAll(pattern)];
    if (matches.length > 0) {
      const match = matches[0];
      let year, month, day;
      
      if (match.length === 4) {
        // 完整日期格式
        [, year, month, day] = match;
      } else if (match.length === 3) {
        // 只有月日格式
        year = new Date().getFullYear();
        [, month, day] = match;
      }
      
      // 驗證日期有效性
      const date = new Date(year, parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  return null;
}

/**
 * 提取地點
 */
function extractLocation(description) {
  const locationKeywords = [
    '台北', '新北', '桃園', '台中', '台南', '高雄',
    '基隆', '新竹', '苗栗', '彰化', '南投', '雲林',
    '嘉義', '屏東', '宜蘭', '花蓮', '台東', '澎湖',
    '金門', '連江', '線上', '網路', 'online'
  ];
  
  for (const keyword of locationKeywords) {
    if (description.includes(keyword)) {
      // 提取包含關鍵字的句子
      const sentences = description.split(/[。！？\n]/);
      for (const sentence of sentences) {
        if (sentence.includes(keyword)) {
          return sentence.trim().substring(0, 100);
        }
      }
    }
  }
  
  return '請參考官方網站';
}

/**
 * 提取聯絡資訊
 */
function extractContact(description) {
  // 電話號碼
  const phonePattern = /(\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4})/g;
  const phoneMatch = description.match(phonePattern);
  if (phoneMatch) return phoneMatch[0];
  
  // Email
  const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
  const emailMatch = description.match(emailPattern);
  if (emailMatch) return emailMatch[0];
  
  return '請參考官方網站';
}

/**
 * 提取獎項資訊
 */
function extractPrize(description) {
  const prizeKeywords = ['獎金', '獎品', '獎項', '獎勵', '第一名', '冠軍', '優勝'];
  
  for (const keyword of prizeKeywords) {
    if (description.includes(keyword)) {
      const sentences = description.split(/[。！？\n]/);
      for (const sentence of sentences) {
        if (sentence.includes(keyword)) {
          return sentence.trim().substring(0, 200);
        }
      }
    }
  }
  
  return '請參考官方網站';
}

/**
 * 提取費用資訊
 */
function extractFee(description) {
  if (description.includes('免費') || description.includes('不收費')) {
    return '免費';
  }
  
  const feePattern = /(\d+)\s*元/g;
  const feeMatch = description.match(feePattern);
  if (feeMatch) return feeMatch[0];
  
  return '請參考官方網站';
}

/**
 * 判斷狀態
 */
function determineStatus(data) {
  const now = new Date();
  
  if (data.registration_end) {
    const regEnd = new Date(data.registration_end);
    if (regEnd < now) return 'expired';
  }
  
  if (data.competition_date) {
    const compDate = new Date(data.competition_date);
    if (compDate < now) return 'expired';
  }
  
  return 'active';
}

/**
 * 清理標題
 */
function cleanTitle(title) {
  return title
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/【.*?】/g, '')
    .replace(/\[.*?\]/g, '')
    .substring(0, 200);
}

/**
 * 清理描述
 */
function cleanDescription(description) {
  return description
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/<[^>]*>/g, '')
    .substring(0, 2000);
}

/**
 * 提取主辦單位
 */
function extractOrganizer(text) {
  const organizerKeywords = [
    '主辦', '主辦單位', '承辦', '承辦單位', '指導單位'
  ];
  
  for (const keyword of organizerKeywords) {
    const index = text.indexOf(keyword);
    if (index !== -1) {
      const afterKeyword = text.substring(index + keyword.length);
      const match = afterKeyword.match(/[:：]\s*([^。！？\n]+)/);
      if (match) {
        return match[1].trim().substring(0, 100);
      }
    }
  }
  
  return '請參考官方網站';
}

/**
 * 驗證比賽資料是否有效
 */
function isValidCompetition(data) {
  // 基本必填欄位檢查
  if (!data.title || data.title.length < 3) return false;
  if (!data.organizer || data.organizer === '未知主辦單位') return false;
  
  // 檢查是否為未來的活動
  if (data.status === 'expired') return false;
  
  // 檢查描述長度
  if (data.description && data.description.length < 10) return false;
  
  return true;
}

// 匯出函數
module.exports = {
  normalizeData,
  generateId,
  generateHashKey,
  categorizeSTEAM,
  extractTargetAudience,
  isValidCompetition
};

// n8n Code 節點使用範例
if (typeof $input !== 'undefined') {
  const items = $input.all();
  return normalizeData(items);
}
