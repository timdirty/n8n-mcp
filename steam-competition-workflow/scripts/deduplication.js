/**
 * 去重處理模組
 * 用於識別和過濾重複的比賽資訊
 */

/**
 * 主要去重函數
 * @param {Array} newItems - 新蒐集的資料
 * @param {Array} existingData - 現有資料庫中的資料
 * @returns {Array} 去重後的新資料
 */
function deduplicateData(newItems, existingData) {
  // 建立現有資料的索引
  const existingHashes = new Set();
  const existingUrls = new Set();
  const existingTitles = new Map(); // title -> {organizer, date}
  
  existingData.forEach(item => {
    const data = item.json;
    
    if (data.hash_key) {
      existingHashes.add(data.hash_key);
    }
    
    if (data.url) {
      existingUrls.add(normalizeUrl(data.url));
    }
    
    if (data.title) {
      const normalizedTitle = normalizeTitle(data.title);
      if (!existingTitles.has(normalizedTitle)) {
        existingTitles.set(normalizedTitle, []);
      }
      existingTitles.get(normalizedTitle).push({
        organizer: data.organizer,
        scraped_at: data.scraped_at
      });
    }
  });
  
  // 過濾新資料
  const trulyNewItems = [];
  const duplicateReasons = [];
  
  for (const item of newItems) {
    const data = item.json;
    const isDuplicate = checkDuplicate(
      data,
      existingHashes,
      existingUrls,
      existingTitles,
      duplicateReasons
    );
    
    if (!isDuplicate) {
      trulyNewItems.push(item);
    }
  }
  
  // 返回結果和統計資訊
  return {
    new_items: trulyNewItems,
    duplicate_count: newItems.length - trulyNewItems.length,
    total_count: newItems.length,
    dedup_rate: ((newItems.length - trulyNewItems.length) / newItems.length * 100).toFixed(2),
    duplicate_reasons: duplicateReasons
  };
}

/**
 * 檢查是否為重複資料
 */
function checkDuplicate(data, existingHashes, existingUrls, existingTitles, reasons) {
  // 檢查 1: Hash Key 完全相同
  if (data.hash_key && existingHashes.has(data.hash_key)) {
    reasons.push({
      title: data.title,
      reason: 'hash_key_match',
      hash_key: data.hash_key
    });
    return true;
  }
  
  // 檢查 2: URL 完全相同
  if (data.url) {
    const normalizedUrl = normalizeUrl(data.url);
    if (existingUrls.has(normalizedUrl)) {
      reasons.push({
        title: data.title,
        reason: 'url_match',
        url: data.url
      });
      return true;
    }
  }
  
  // 檢查 3: 標題相似度 + 主辦單位相同
  if (data.title) {
    const normalizedTitle = normalizeTitle(data.title);
    if (existingTitles.has(normalizedTitle)) {
      const existingRecords = existingTitles.get(normalizedTitle);
      for (const record of existingRecords) {
        if (isSameOrganizer(data.organizer, record.organizer)) {
          reasons.push({
            title: data.title,
            reason: 'title_organizer_match',
            organizer: data.organizer
          });
          return true;
        }
      }
    }
  }
  
  // 檢查 4: 標題高度相似（編輯距離）
  if (data.title) {
    for (const [existingTitle, records] of existingTitles.entries()) {
      const similarity = calculateSimilarity(
        normalizeTitle(data.title),
        existingTitle
      );
      
      if (similarity > 0.85) {
        for (const record of records) {
          if (isSameOrganizer(data.organizer, record.organizer)) {
            reasons.push({
              title: data.title,
              reason: 'high_similarity',
              similarity: similarity.toFixed(2),
              existing_title: existingTitle
            });
            return true;
          }
        }
      }
    }
  }
  
  // 檢查 5: 時間窗口內的重複（30天內）
  if (data.title && data.scraped_at) {
    const normalizedTitle = normalizeTitle(data.title);
    if (existingTitles.has(normalizedTitle)) {
      const existingRecords = existingTitles.get(normalizedTitle);
      for (const record of existingRecords) {
        const daysDiff = getDaysDifference(data.scraped_at, record.scraped_at);
        if (daysDiff <= 30 && isSameOrganizer(data.organizer, record.organizer)) {
          reasons.push({
            title: data.title,
            reason: 'time_window_duplicate',
            days_diff: daysDiff
          });
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * 標準化 URL
 */
function normalizeUrl(url) {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '');
}

/**
 * 標準化標題
 */
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\w\u4e00-\u9fff]/g, '')
    .replace(/第?\d+屆/g, '')
    .replace(/\d{4}年?/g, '')
    .replace(/\d{4}/g, '');
}

/**
 * 判斷是否為相同主辦單位
 */
function isSameOrganizer(org1, org2) {
  if (!org1 || !org2) return false;
  
  const normalized1 = org1.toLowerCase().replace(/\s+/g, '');
  const normalized2 = org2.toLowerCase().replace(/\s+/g, '');
  
  // 完全相同
  if (normalized1 === normalized2) return true;
  
  // 包含關係
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // 移除常見後綴後比較
  const suffixes = ['教育局', '教育處', '教育部', '科技部', '文化局', '政府'];
  let clean1 = normalized1;
  let clean2 = normalized2;
  
  suffixes.forEach(suffix => {
    clean1 = clean1.replace(suffix, '');
    clean2 = clean2.replace(suffix, '');
  });
  
  return clean1 === clean2;
}

/**
 * 計算字串相似度（Levenshtein Distance）
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein Distance 演算法
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  // 初始化矩陣
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // 填充矩陣
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 替換
          matrix[i][j - 1] + 1,     // 插入
          matrix[i - 1][j] + 1      // 刪除
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 計算日期差異（天數）
 */
function getDaysDifference(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * 批次去重（用於大量資料）
 */
function batchDeduplicate(newItems, existingData, batchSize = 100) {
  const results = [];
  const totalBatches = Math.ceil(newItems.length / batchSize);
  
  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, newItems.length);
    const batch = newItems.slice(start, end);
    
    const batchResult = deduplicateData(batch, existingData);
    results.push(batchResult);
    
    // 將新資料加入現有資料索引，供下一批次使用
    existingData = existingData.concat(batchResult.new_items);
  }
  
  // 合併所有批次結果
  return {
    new_items: results.flatMap(r => r.new_items),
    duplicate_count: results.reduce((sum, r) => sum + r.duplicate_count, 0),
    total_count: results.reduce((sum, r) => sum + r.total_count, 0),
    duplicate_reasons: results.flatMap(r => r.duplicate_reasons)
  };
}

/**
 * 生成去重報告
 */
function generateDedupReport(result) {
  const report = {
    summary: {
      total_items: result.total_count,
      new_items: result.new_items.length,
      duplicates: result.duplicate_count,
      dedup_rate: result.dedup_rate + '%'
    },
    duplicate_breakdown: {},
    timestamp: new Date().toISOString()
  };
  
  // 統計重複原因
  result.duplicate_reasons.forEach(item => {
    if (!report.duplicate_breakdown[item.reason]) {
      report.duplicate_breakdown[item.reason] = 0;
    }
    report.duplicate_breakdown[item.reason]++;
  });
  
  return report;
}

// 匯出函數
module.exports = {
  deduplicateData,
  batchDeduplicate,
  generateDedupReport,
  calculateSimilarity,
  normalizeTitle,
  normalizeUrl
};

// n8n Code 節點使用範例
if (typeof $input !== 'undefined') {
  const newItems = $input.all();
  const existingData = $('Google Sheets').all();
  
  const result = deduplicateData(newItems, existingData);
  
  // 返回新資料
  return result.new_items;
}
