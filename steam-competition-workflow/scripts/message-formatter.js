/**
 * LINE 訊息格式化模組
 * 用於生成各種格式的 LINE 推播訊息
 */

/**
 * 格式化純文字訊息（MVP 版本）
 */
function formatTextMessage(competitions, options = {}) {
  const {
    maxItems = 5,
    sheetUrl = '',
    groupName = ''
  } = options;
  
  if (competitions.length === 0) {
    return {
      message: '今日無新的 STEAM 比賽資訊 📚',
      has_data: false
    };
  }
  
  let message = groupName 
    ? `🏆 ${groupName} - 今日新增 ${competitions.length} 項比賽資訊\n\n`
    : `🏆 今日新增 ${competitions.length} 項 STEAM 比賽資訊\n\n`;
  
  // 顯示前 N 筆詳細資訊
  competitions.slice(0, maxItems).forEach((comp, index) => {
    const data = comp.json;
    message += `${index + 1}. ${data.title}\n`;
    message += `📅 報名截止: ${formatDate(data.registration_end)}\n`;
    message += `🎯 對象: ${data.target_audience}\n`;
    message += `🏢 主辦: ${data.organizer}\n`;
    if (data.url) message += `🔗 ${data.url}\n`;
    message += `\n`;
  });
  
  // 如果還有更多資料
  if (competitions.length > maxItems) {
    message += `...還有 ${competitions.length - maxItems} 項比賽\n\n`;
  }
  
  // 添加完整清單連結
  if (sheetUrl) {
    message += `📋 完整清單：${sheetUrl}`;
  }
  
  return {
    message: message,
    has_data: true,
    count: competitions.length
  };
}

/**
 * 格式化分類摘要訊息
 */
function formatCategorySummary(competitions, options = {}) {
  const { sheetUrl = '' } = options;
  
  if (competitions.length === 0) {
    return formatTextMessage(competitions, options);
  }
  
  // 按類別分組
  const categories = {
    'Science': { emoji: '🔬', name: '科學類', items: [] },
    'Technology': { emoji: '💻', name: '技術類', items: [] },
    'Engineering': { emoji: '⚙️', name: '工程類', items: [] },
    'Arts': { emoji: '🎨', name: '藝術類', items: [] },
    'Math': { emoji: '📊', name: '數學類', items: [] },
    'Mixed': { emoji: '🌟', name: '綜合類', items: [] }
  };
  
  competitions.forEach(comp => {
    const category = comp.json.category || 'Mixed';
    if (categories[category]) {
      categories[category].items.push(comp.json);
    }
  });
  
  let message = `🏆 今日新增 ${competitions.length} 項 STEAM 比賽資訊\n\n`;
  
  // 顯示各類別摘要
  Object.entries(categories).forEach(([key, cat]) => {
    if (cat.items.length > 0) {
      message += `${cat.emoji} ${cat.name} (${cat.items.length}項)\n`;
      cat.items.slice(0, 3).forEach(item => {
        message += `• ${item.title} (${formatDate(item.registration_end)}截止)\n`;
      });
      if (cat.items.length > 3) {
        message += `• ...還有 ${cat.items.length - 3} 項\n`;
      }
      message += `\n`;
    }
  });
  
  if (sheetUrl) {
    message += `📋 完整清單：${sheetUrl}`;
  }
  
  return {
    message: message,
    has_data: true,
    count: competitions.length,
    categories_summary: Object.entries(categories)
      .filter(([, cat]) => cat.items.length > 0)
      .map(([key, cat]) => ({ category: key, count: cat.items.length }))
  };
}

/**
 * 格式化 Flex Message（進階版本）
 */
function formatFlexMessage(competitions, options = {}) {
  const { maxCards = 10, sheetId = '' } = options;
  
  if (competitions.length === 0) {
    return null;
  }
  
  const bubbles = competitions.slice(0, maxCards).map(comp => 
    createCompetitionBubble(comp.json, sheetId)
  );
  
  return {
    type: 'flex',
    altText: `今日新增 ${competitions.length} 項 STEAM 比賽資訊`,
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  };
}

/**
 * 建立單一比賽卡片
 */
function createCompetitionBubble(data, sheetId) {
  return {
    type: 'bubble',
    hero: {
      type: 'image',
      url: data.image_url || 'https://via.placeholder.com/800x400?text=STEAM+Competition',
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: getCategoryEmoji(data.category) + ' ' + data.category,
          color: getCategoryColor(data.category),
          size: 'sm',
          weight: 'bold'
        },
        {
          type: 'text',
          text: data.title,
          weight: 'bold',
          size: 'xl',
          wrap: true,
          margin: 'md'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            createInfoRow('主辦', data.organizer),
            createInfoRow('對象', data.target_audience),
            createInfoRow('截止', formatDate(data.registration_end)),
            createInfoRow('地點', data.location || '請參考官網')
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: {
            type: 'uri',
            label: '立即報名',
            uri: data.url || 'https://www.google.com'
          }
        },
        {
          type: 'button',
          style: 'link',
          height: 'sm',
          action: {
            type: 'uri',
            label: '查看詳情',
            uri: `https://docs.google.com/spreadsheets/d/${sheetId}`
          }
        }
      ],
      flex: 0
    }
  };
}

/**
 * 建立資訊列
 */
function createInfoRow(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      {
        type: 'text',
        text: label,
        color: '#aaaaaa',
        size: 'sm',
        flex: 1
      },
      {
        type: 'text',
        text: value || '未提供',
        wrap: true,
        color: '#666666',
        size: 'sm',
        flex: 4
      }
    ]
  };
}

/**
 * 取得類別顏色
 */
function getCategoryColor(category) {
  const colors = {
    'Science': '#4CAF50',
    'Technology': '#2196F3',
    'Engineering': '#FF9800',
    'Arts': '#E91E63',
    'Math': '#9C27B0',
    'Mixed': '#607D8B'
  };
  return colors[category] || '#607D8B';
}

/**
 * 取得類別 Emoji
 */
function getCategoryEmoji(category) {
  const emojis = {
    'Science': '🔬',
    'Technology': '💻',
    'Engineering': '⚙️',
    'Arts': '🎨',
    'Math': '📊',
    'Mixed': '🌟'
  };
  return emojis[category] || '🌟';
}

/**
 * 格式化日期
 */
function formatDate(dateStr) {
  if (!dateStr) return '未公布';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '未公布';
    
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  } catch (error) {
    return '未公布';
  }
}

/**
 * 格式化完整日期
 */
function formatFullDate(dateStr) {
  if (!dateStr) return '未公布';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '未公布';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  } catch (error) {
    return '未公布';
  }
}

// 匯出函數
module.exports = {
  formatTextMessage,
  formatCategorySummary,
  formatFlexMessage,
  formatDate,
  formatFullDate
};

// n8n Code 節點使用範例
if (typeof $input !== 'undefined') {
  const competitions = $input.all();
  const sheetId = $('Set (Config)').first().json.sheet_id;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
  
  // 根據資料量選擇格式
  if (competitions.length <= 3) {
    return [{ json: formatTextMessage(competitions, { sheetUrl }) }];
  } else {
    return [{ json: formatCategorySummary(competitions, { sheetUrl }) }];
  }
}
