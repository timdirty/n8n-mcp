/**
 * LINE Flex Message 格式化
 * 為 STEAM 比賽資訊建立美觀的 Flex Message
 */

/**
 * STEAM 類別顏色配置
 */
const CATEGORY_COLORS = {
  S: { primary: '#4CAF50', secondary: '#81C784', name: '科學' },
  T: { primary: '#2196F3', secondary: '#64B5F6', name: '技術' },
  E: { primary: '#FF9800', secondary: '#FFB74D', name: '工程' },
  A: { primary: '#E91E63', secondary: '#F06292', name: '藝術' },
  M: { primary: '#9C27B0', secondary: '#BA68C8', name: '數學' }
};

/**
 * 建立類別標籤
 */
function createCategoryBadges(categories) {
  return categories.map(cat => ({
    type: 'box',
    layout: 'baseline',
    contents: [
      {
        type: 'text',
        text: CATEGORY_COLORS[cat]?.name || cat,
        color: '#ffffff',
        size: 'xs',
        flex: 0,
        weight: 'bold'
      }
    ],
    backgroundColor: CATEGORY_COLORS[cat]?.primary || '#999999',
    cornerRadius: 'md',
    paddingAll: 'sm',
    margin: 'xs'
  }));
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
  if (!dateString) return '日期未定';
  
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}/${month}/${day}`;
}

/**
 * 建立 Flex Message Bubble
 */
function createFlexMessage(competition) {
  const primaryCategory = competition.classification?.primary || competition.categories?.[0] || 'T';
  const categories = competition.classification?.categories || competition.categories || [primaryCategory];
  const summary = competition.summary?.summary || competition.summary || competition.description?.substring(0, 150) || '';
  const keyPoints = competition.summary?.keyPoints || [];
  
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: createCategoryBadges(categories)
        }
      ],
      backgroundColor: CATEGORY_COLORS[primaryCategory]?.secondary || '#f0f0f0',
      paddingAll: 'md'
    },
    hero: {
      type: 'image',
      url: competition.image || 'https://via.placeholder.com/800x400?text=STEAM+Competition',
      size: 'full',
      aspectRatio: '20:13',
      aspectMode: 'cover',
      action: {
        type: 'uri',
        uri: competition.url || 'https://example.com'
      }
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: competition.title || '未命名比賽',
          weight: 'bold',
          size: 'xl',
          wrap: true,
          color: '#1a1a1a'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '📅',
                  color: '#aaaaaa',
                  size: 'sm',
                  flex: 0
                },
                {
                  type: 'text',
                  text: formatDate(competition.publishDate || competition.date),
                  wrap: true,
                  color: '#666666',
                  size: 'sm',
                  flex: 5
                }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              spacing: 'sm',
              contents: [
                {
                  type: 'text',
                  text: '🏢',
                  color: '#aaaaaa',
                  size: 'sm',
                  flex: 0
                },
                {
                  type: 'text',
                  text: competition.source || '未知來源',
                  wrap: true,
                  color: '#666666',
                  size: 'sm',
                  flex: 5
                }
              ]
            }
          ]
        },
        {
          type: 'separator',
          margin: 'lg'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            {
              type: 'text',
              text: summary,
              wrap: true,
              color: '#333333',
              size: 'sm',
              lineSpacing: 'md'
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        ...(keyPoints.length > 0 ? [
          {
            type: 'box',
            layout: 'vertical',
            spacing: 'xs',
            contents: keyPoints.map(point => ({
              type: 'text',
              text: `• ${point}`,
              size: 'xs',
              color: '#666666',
              wrap: true
            }))
          },
          {
            type: 'separator',
            margin: 'md'
          }
        ] : []),
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: {
            type: 'uri',
            label: '查看詳情',
            uri: competition.url || 'https://example.com'
          },
          color: CATEGORY_COLORS[primaryCategory]?.primary || '#2196F3'
        },
        {
          type: 'button',
          style: 'link',
          height: 'sm',
          action: {
            type: 'uri',
            label: '分享給朋友',
            uri: `https://line.me/R/msg/text/?${encodeURIComponent(competition.title + ' ' + competition.url)}`
          }
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `信心分數：${Math.round((competition.classification?.confidence || 0.9) * 100)}%`,
              size: 'xxs',
              color: '#aaaaaa',
              align: 'center'
            }
          ],
          margin: 'sm'
        }
      ],
      flex: 0
    }
  };
}

/**
 * 建立 Carousel 訊息（多個比賽）
 */
function createCarouselMessage(competitions) {
  return {
    type: 'carousel',
    contents: competitions.slice(0, 10).map(comp => createFlexMessage(comp))
  };
}

/**
 * n8n Function 節點主函式
 */
const items = $input.all();
const results = [];

// 如果有多個項目，建立 Carousel
if (items.length > 1) {
  const competitions = items.map(item => item.json);
  const carouselMessage = createCarouselMessage(competitions);
  
  results.push({
    json: {
      type: 'flex',
      altText: `發現 ${items.length} 個新的 STEAM 比賽資訊`,
      contents: carouselMessage
    }
  });
} else if (items.length === 1) {
  // 單一項目，建立 Bubble
  const competition = items[0].json;
  const flexMessage = createFlexMessage(competition);
  
  results.push({
    json: {
      type: 'flex',
      altText: competition.title || '新的 STEAM 比賽資訊',
      contents: flexMessage
    }
  });
}

return results;
