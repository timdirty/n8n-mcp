/**
 * 5 層去重機制實作
 * 用於 n8n Function 節點
 */

// 引入必要的函式庫（在 n8n 中可用）
const crypto = require('crypto');

/**
 * 計算字串的 MD5 雜湊值
 */
function calculateHash(data) {
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
}

/**
 * 計算 Levenshtein 距離（編輯距離）
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * 計算字串相似度（0-1，1 表示完全相同）
 */
function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * 計算 TF-IDF 向量
 */
function calculateTFIDF(text, corpus) {
  const words = text.toLowerCase().match(/[\u4e00-\u9fa5a-z0-9]+/g) || [];
  const wordFreq = {};
  
  // 計算詞頻 (TF)
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // 計算 IDF
  const idf = {};
  Object.keys(wordFreq).forEach(word => {
    const docCount = corpus.filter(doc => 
      doc.toLowerCase().includes(word)
    ).length;
    idf[word] = Math.log((corpus.length + 1) / (docCount + 1));
  });
  
  // 計算 TF-IDF
  const tfidf = {};
  Object.keys(wordFreq).forEach(word => {
    tfidf[word] = wordFreq[word] * idf[word];
  });
  
  return tfidf;
}

/**
 * 計算餘弦相似度
 */
function cosineSimilarity(vec1, vec2) {
  const allKeys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;
  
  allKeys.forEach(key => {
    const v1 = vec1[key] || 0;
    const v2 = vec2[key] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });
  
  if (mag1 === 0 || mag2 === 0) return 0;
  return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
}

/**
 * 5 層去重主函式
 * @param {Object} newItem - 新的比賽資訊
 * @param {Array} existingItems - 現有的比賽資訊列表
 * @param {Object} options - 配置選項
 * @returns {Object} - { isDuplicate: boolean, reason: string, matchedItem: Object }
 */
function checkDuplication(newItem, existingItems, options = {}) {
  const config = {
    titleSimilarityThreshold: options.titleSimilarityThreshold || 0.85,
    contentSimilarityThreshold: options.contentSimilarityThreshold || 0.90,
    timeWindowDays: options.timeWindowDays || 7,
    ...options
  };
  
  const timeWindowMs = config.timeWindowDays * 24 * 60 * 60 * 1000;
  const newItemTimestamp = new Date(newItem.publishDate || newItem.timestamp).getTime();
  
  // 第 1 層：Hash 去重
  const newItemHash = calculateHash({
    title: newItem.title,
    url: newItem.url,
    description: newItem.description
  });
  
  for (const existing of existingItems) {
    const existingHash = calculateHash({
      title: existing.title,
      url: existing.url,
      description: existing.description
    });
    
    if (newItemHash === existingHash) {
      return {
        isDuplicate: true,
        reason: 'Layer 1: Hash match (完全相同)',
        layer: 1,
        matchedItem: existing
      };
    }
  }
  
  // 第 2 層：URL 去重
  if (newItem.url) {
    for (const existing of existingItems) {
      if (existing.url === newItem.url) {
        return {
          isDuplicate: true,
          reason: 'Layer 2: URL match (相同網址)',
          layer: 2,
          matchedItem: existing
        };
      }
    }
  }
  
  // 第 3 層：標題相似度去重
  for (const existing of existingItems) {
    const similarity = calculateSimilarity(
      newItem.title || '',
      existing.title || ''
    );
    
    if (similarity >= config.titleSimilarityThreshold) {
      return {
        isDuplicate: true,
        reason: `Layer 3: Title similarity ${(similarity * 100).toFixed(1)}% (標題相似)`,
        layer: 3,
        similarity: similarity,
        matchedItem: existing
      };
    }
  }
  
  // 第 4 層：時間窗口去重
  for (const existing of existingItems) {
    const existingTimestamp = new Date(existing.publishDate || existing.timestamp).getTime();
    const timeDiff = Math.abs(newItemTimestamp - existingTimestamp);
    
    if (timeDiff <= timeWindowMs) {
      // 在時間窗口內，檢查標題是否相似（較寬鬆的閾值）
      const similarity = calculateSimilarity(
        newItem.title || '',
        existing.title || ''
      );
      
      if (similarity >= 0.70) {
        return {
          isDuplicate: true,
          reason: `Layer 4: Time window match (${Math.floor(timeDiff / (24 * 60 * 60 * 1000))} 天內相似)`,
          layer: 4,
          timeDiff: timeDiff,
          similarity: similarity,
          matchedItem: existing
        };
      }
    }
  }
  
  // 第 5 層：內容相似度去重（TF-IDF + Cosine Similarity）
  const corpus = existingItems.map(item => item.description || item.content || '');
  corpus.push(newItem.description || newItem.content || '');
  
  const newItemVector = calculateTFIDF(newItem.description || newItem.content || '', corpus);
  
  for (const existing of existingItems) {
    const existingVector = calculateTFIDF(existing.description || existing.content || '', corpus);
    const similarity = cosineSimilarity(newItemVector, existingVector);
    
    if (similarity >= config.contentSimilarityThreshold) {
      return {
        isDuplicate: true,
        reason: `Layer 5: Content similarity ${(similarity * 100).toFixed(1)}% (內容相似)`,
        layer: 5,
        similarity: similarity,
        matchedItem: existing
      };
    }
  }
  
  // 通過所有去重檢查
  return {
    isDuplicate: false,
    reason: 'Passed all deduplication layers (通過所有檢查)',
    layer: 0
  };
}

/**
 * n8n Function 節點主函式
 * 處理輸入的項目並返回去重後的結果
 */
const items = $input.all();
const existingItems = $('Google Sheets').all(); // 從 Google Sheets 節點獲取現有資料

const results = [];
const duplicates = [];
const stats = {
  total: items.length,
  unique: 0,
  duplicates: 0,
  byLayer: {
    1: 0, // Hash
    2: 0, // URL
    3: 0, // Title similarity
    4: 0, // Time window
    5: 0  // Content similarity
  }
};

for (const item of items) {
  const checkResult = checkDuplication(item.json, existingItems.map(e => e.json));
  
  if (checkResult.isDuplicate) {
    stats.duplicates++;
    stats.byLayer[checkResult.layer]++;
    duplicates.push({
      json: {
        ...item.json,
        deduplication: checkResult
      }
    });
  } else {
    stats.unique++;
    results.push({
      json: {
        ...item.json,
        deduplication: checkResult,
        processedAt: new Date().toISOString()
      }
    });
  }
}

// 輸出統計資訊到日誌
console.log('去重統計:', JSON.stringify(stats, null, 2));

// 返回去重後的唯一項目
return results;
