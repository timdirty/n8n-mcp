/**
 * LINE 訊息格式化模組
 * 用於生成各種格式的 LINE 推播訊息（純文字版）
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TextCompetition {
  title: string;
  organizer: string;
  category: string;
  target_audience: string;
  registration_end: string | null;
  url: string | null;
}

export interface FormatOptions {
  maxItems?: number;
  groupName?: string;
}

export interface FormattedMessage {
  message: string;
  hasData: boolean;
  count: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 格式化日期，gracefully handle null / invalid values.
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '未公布';

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '未公布';

    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  } catch {
    return '未公布';
  }
}

// ---------------------------------------------------------------------------
// Category definitions (for grouping)
// ---------------------------------------------------------------------------

interface CategoryDef {
  emoji: string;
  name: string;
  items: TextCompetition[];
}

function buildCategoryMap(): Record<string, CategoryDef> {
  return {
    Science: { emoji: '🔬', name: '科學類', items: [] },
    Technology: { emoji: '💻', name: '技術類', items: [] },
    Engineering: { emoji: '⚙️', name: '工程類', items: [] },
    Arts: { emoji: '🎨', name: '藝術類', items: [] },
    Math: { emoji: '📊', name: '數學類', items: [] },
    Mixed: { emoji: '🌟', name: '綜合類', items: [] },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 格式化純文字訊息
 */
export function formatTextMessage(
  comps: TextCompetition[],
  opts: FormatOptions = {},
): FormattedMessage {
  const { maxItems = 5, groupName = '' } = opts;

  if (comps.length === 0) {
    return {
      message: '今日無新的 STEAM 比賽資訊 📚',
      hasData: false,
      count: 0,
    };
  }

  let message = groupName
    ? `🏆 ${groupName} - 今日新增 ${comps.length} 項比賽資訊\n\n`
    : `🏆 今日新增 ${comps.length} 項 STEAM 比賽資訊\n\n`;

  // 顯示前 N 筆詳細資訊
  comps.slice(0, maxItems).forEach((comp, index) => {
    message += `${index + 1}. ${comp.title}\n`;
    message += `📅 報名截止: ${formatDate(comp.registration_end)}\n`;
    message += `🎯 對象: ${comp.target_audience}\n`;
    message += `🏢 主辦: ${comp.organizer}\n`;
    if (comp.url) message += `🔗 ${comp.url}\n`;
    message += '\n';
  });

  // 如果還有更多資料
  if (comps.length > maxItems) {
    message += `...還有 ${comps.length - maxItems} 項比賽\n\n`;
  }

  return {
    message,
    hasData: true,
    count: comps.length,
  };
}

/**
 * 格式化分類摘要訊息（按 STEAM 類別分組）
 */
export function formatCategorySummary(
  comps: TextCompetition[],
  opts: FormatOptions = {},
): FormattedMessage {
  if (comps.length === 0) {
    return formatTextMessage(comps, opts);
  }

  // 按類別分組
  const categories = buildCategoryMap();

  for (const comp of comps) {
    const category = comp.category || 'Mixed';
    if (categories[category]) {
      categories[category].items.push(comp);
    } else {
      categories['Mixed'].items.push(comp);
    }
  }

  let message = `🏆 今日新增 ${comps.length} 項 STEAM 比賽資訊\n\n`;

  // 顯示各類別摘要
  for (const [_key, cat] of Object.entries(categories)) {
    if (cat.items.length > 0) {
      message += `${cat.emoji} ${cat.name} (${cat.items.length}項)\n`;
      cat.items.slice(0, 3).forEach(item => {
        message += `• ${item.title} (${formatDate(item.registration_end)}截止)\n`;
      });
      if (cat.items.length > 3) {
        message += `• ...還有 ${cat.items.length - 3} 項\n`;
      }
      message += '\n';
    }
  }

  return {
    message,
    hasData: true,
    count: comps.length,
  };
}
