/**
 * LINE Flex Message 格式化
 * 為 STEAM 比賽資訊建立美觀的 Flex Message
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FlexCompetition {
  title: string;
  organizer: string;
  category: string;
  target_audience: string;
  registration_end: string | null;
  location: string | null;
  url: string | null;
  source: string;
  ai_categories?: string | null;
  ai_primary?: string | null;
  ai_confidence?: number | null;
  ai_summary?: string | null;
  ai_key_points?: string | null;
  ai_call_to_action?: string | null;
  description?: string | null;
}

export interface FlexBubble {
  type: 'bubble';
  size: string;
  header: Record<string, unknown>;
  body: Record<string, unknown>;
  footer: Record<string, unknown>;
}

export interface FlexContainer {
  type: 'carousel' | 'bubble';
  contents?: FlexBubble[];
  [key: string]: unknown;
}

export interface LineMessage {
  type: 'flex';
  altText: string;
  contents: FlexContainer;
}

// ---------------------------------------------------------------------------
// STEAM 類別顏色配置
// ---------------------------------------------------------------------------

interface CategoryColor {
  primary: string;
  secondary: string;
  name: string;
}

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  S: { primary: '#4CAF50', secondary: '#81C784', name: '科學' },
  T: { primary: '#2196F3', secondary: '#64B5F6', name: '技術' },
  E: { primary: '#FF9800', secondary: '#FFB74D', name: '工程' },
  A: { primary: '#E91E63', secondary: '#F06292', name: '藝術' },
  M: { primary: '#9C27B0', secondary: '#BA68C8', name: '數學' },
};

const CATEGORY_EMOJI: Record<string, string> = {
  Science: '🔬',
  Technology: '💻',
  Engineering: '⚙️',
  Arts: '🎨',
  Math: '📊',
  Mixed: '🌟',
};

const CATEGORY_COLOR_MAP: Record<string, string> = {
  Science: '#4CAF50',
  Technology: '#2196F3',
  Engineering: '#FF9800',
  Arts: '#E91E63',
  Math: '#9C27B0',
  Mixed: '#607D8B',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 格式化日期
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return '日期未定';

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '日期未定';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}/${month}/${day}`;
  } catch {
    return '日期未定';
  }
}

/**
 * Resolve the AI primary category to a single-letter STEAM key.
 * Falls back to mapping the `category` field if AI data is unavailable.
 */
function resolvePrimaryCategory(comp: FlexCompetition): string {
  if (comp.ai_primary && CATEGORY_COLORS[comp.ai_primary]) {
    return comp.ai_primary;
  }
  // Map full category name to letter
  const mapping: Record<string, string> = {
    Science: 'S',
    Technology: 'T',
    Engineering: 'E',
    Arts: 'A',
    Math: 'M',
  };
  return mapping[comp.category] ?? 'T';
}

/**
 * Resolve AI categories to an array of single-letter STEAM keys.
 */
function resolveCategories(comp: FlexCompetition): string[] {
  if (comp.ai_categories) {
    const cats = comp.ai_categories.split(',').map(c => c.trim()).filter(Boolean);
    if (cats.length > 0) return cats;
  }
  const primary = resolvePrimaryCategory(comp);
  return [primary];
}

/**
 * 建立類別標籤
 */
function createCategoryBadges(categories: string[]): Record<string, unknown>[] {
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
        weight: 'bold',
      },
    ],
    backgroundColor: CATEGORY_COLORS[cat]?.primary || '#999999',
    cornerRadius: 'md',
    paddingAll: 'sm',
    margin: 'xs',
  }));
}

/**
 * 建立資訊列
 */
function createInfoRow(label: string, value: string): Record<string, unknown> {
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
        flex: 1,
      },
      {
        type: 'text',
        text: value || '未提供',
        wrap: true,
        color: '#666666',
        size: 'sm',
        flex: 4,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 建立 Flex Message Bubble（單一比賽卡片）
 */
export function createFlexBubble(comp: FlexCompetition): FlexBubble {
  const primaryCategory = resolvePrimaryCategory(comp);
  const categories = resolveCategories(comp);
  const summary = comp.ai_summary || comp.description?.substring(0, 150) || '';

  let keyPoints: string[] = [];
  if (comp.ai_key_points) {
    try {
      const parsed = JSON.parse(comp.ai_key_points);
      if (Array.isArray(parsed)) keyPoints = parsed;
    } catch {
      // ai_key_points may be a plain string; ignore parse failure
    }
  }

  const categoryEmoji = CATEGORY_EMOJI[comp.category] || '🌟';
  const categoryColor = CATEGORY_COLOR_MAP[comp.category] || '#607D8B';

  const footerContents: Record<string, unknown>[] = [];

  // Key points section
  if (keyPoints.length > 0) {
    footerContents.push({
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: keyPoints.map(point => ({
        type: 'text',
        text: `• ${point}`,
        size: 'xs',
        color: '#666666',
        wrap: true,
      })),
    });
    footerContents.push({
      type: 'separator',
      margin: 'md',
    });
  }

  // Action buttons
  footerContents.push({
    type: 'button',
    style: 'primary',
    height: 'sm',
    action: {
      type: 'uri',
      label: '查看詳情',
      uri: comp.url || 'https://example.com',
    },
    color: CATEGORY_COLORS[primaryCategory]?.primary || '#2196F3',
  });

  footerContents.push({
    type: 'button',
    style: 'link',
    height: 'sm',
    action: {
      type: 'uri',
      label: '分享給朋友',
      uri: `https://line.me/R/msg/text/?${encodeURIComponent((comp.title || '') + ' ' + (comp.url || ''))}`,
    },
  });

  // Confidence score
  const confidence = comp.ai_confidence ?? 0.9;
  footerContents.push({
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: `信心分數：${Math.round(confidence * 100)}%`,
        size: 'xxs',
        color: '#aaaaaa',
        align: 'center',
      },
    ],
    margin: 'sm',
  });

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
          contents: createCategoryBadges(categories),
        },
      ],
      backgroundColor: CATEGORY_COLORS[primaryCategory]?.secondary || '#f0f0f0',
      paddingAll: 'md',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `${categoryEmoji} ${comp.category}`,
          color: categoryColor,
          size: 'sm',
          weight: 'bold',
        },
        {
          type: 'text',
          text: comp.title || '未命名比賽',
          weight: 'bold',
          size: 'xl',
          wrap: true,
          color: '#1a1a1a',
          margin: 'md',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            createInfoRow('主辦', comp.organizer),
            createInfoRow('對象', comp.target_audience),
            createInfoRow('截止', formatDate(comp.registration_end)),
            createInfoRow('地點', comp.location || '請參考官網'),
          ],
        },
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            {
              type: 'text',
              text: summary || '暫無摘要',
              wrap: true,
              color: '#333333',
              size: 'sm',
              lineSpacing: 'md',
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: footerContents,
      flex: 0,
    },
  };
}

/**
 * 建立 Carousel 訊息（多個比賽，最多 10 張卡片）
 */
export function createCarousel(comps: FlexCompetition[]): FlexContainer {
  return {
    type: 'carousel',
    contents: comps.slice(0, 10).map(comp => createFlexBubble(comp)),
  };
}

/**
 * 包裝成 LINE push message payload
 */
export function buildFlexPayload(comps: FlexCompetition[]): LineMessage {
  if (comps.length === 0) {
    return {
      type: 'flex',
      altText: '目前沒有新的 STEAM 比賽資訊',
      contents: { type: 'carousel', contents: [] },
    };
  }

  if (comps.length === 1) {
    const bubble = createFlexBubble(comps[0]);
    return {
      type: 'flex',
      altText: comps[0].title || '新的 STEAM 比賽資訊',
      contents: bubble as unknown as FlexContainer,
    };
  }

  const carousel = createCarousel(comps);
  return {
    type: 'flex',
    altText: `發現 ${comps.length} 個新的 STEAM 比賽資訊`,
    contents: carousel,
  };
}
