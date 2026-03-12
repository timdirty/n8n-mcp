# STEAM 工作流程使用指南

## 前置準備

### 1. n8n API 配置

在 n8n UI 中生成 API key：
1. 訪問 http://localhost:5678
2. 登入（admin / admin123）
3. 前往 Settings > API
4. 點擊 "Create API Key"
5. 複製 API key

將 API key 添加到 `.env.n8n` 文件：
```bash
N8N_API_KEY=your-api-key-here
```

### 2. 必要的認證配置

在 n8n UI 中配置以下認證：

#### Google Sheets
1. 前往 Credentials > New
2. 選擇 "Google Sheets OAuth2 API"
3. 按照指示完成 OAuth 認證

#### LINE Messaging API
1. 前往 Credentials > New
2. 選擇 "LINE"
3. 輸入：
   - Channel Access Token
   - Channel Secret

#### OpenAI
1. 前往 Credentials > New
2. 選擇 "OpenAI"
3. 輸入 API Key

#### Notion
1. 前往 Credentials > New
2. 選擇 "Notion API"
3. 輸入 Integration Token

### 3. 建立 Google Sheets

建立一個新的 Google Sheets，包含以下工作表：

#### 主資料表
欄位：
- ID
- 標題
- 描述
- 網址
- 發布日期
- 來源
- 分類（STEAM）
- 摘要
- 處理時間
- 狀態

#### 分類資料表（5 個工作表）
- 科學 (Science)
- 技術 (Technology)
- 工程 (Engineering)
- 藝術 (Arts)
- 數學 (Mathematics)

### 4. 建立 Notion 資料庫

在 Notion 中建立一個新的資料庫，包含以下屬性：
- 標題（Title）
- 描述（Text）
- 網址（URL）
- 發布日期（Date）
- 來源（Select）
- 分類（Multi-select: S, T, E, A, M）
- 摘要（Text）
- 狀態（Select: 新增, 已處理, 已發送）

## 使用 n8n-mcp 工具建立工作流程

### 步驟 1：搜尋所需節點

使用 MCP 工具搜尋節點：

```javascript
// 使用 search_nodes 工具
{
  "query": "RSS Feed",
  "limit": 5
}

{
  "query": "OpenAI",
  "limit": 5
}

{
  "query": "Google Sheets",
  "limit": 5
}

{
  "query": "LINE",
  "limit": 5
}
```

### 步驟 2：獲取節點配置範例

```javascript
// 使用 get_node_examples 工具
{
  "nodeType": "n8n-nodes-base.rssFeedRead",
  "limit": 3
}

{
  "nodeType": "n8n-nodes-base.openAi",
  "limit": 3
}
```

### 步驟 3：驗證節點配置

```javascript
// 使用 validate_node_config 工具
{
  "nodeType": "n8n-nodes-base.rssFeedRead",
  "config": {
    "url": "https://www.edu.tw/rss/news.xml"
  }
}
```

### 步驟 4：建立工作流程

```javascript
// 使用 n8n_create_workflow 工具
{
  "name": "STEAM 教育比賽資訊蒐集系統",
  "nodes": [...],  // 從 steam-complete-workflow.json 複製
  "connections": {...}
}
```

### 步驟 5：驗證工作流程

```javascript
// 使用 validate_workflow 工具
{
  "workflow": {
    "name": "STEAM 教育比賽資訊蒐集系統",
    "nodes": [...],
    "connections": {...}
  }
}
```

## 手動測試

### 1. 測試單一節點

在 n8n UI 中：
1. 開啟工作流程
2. 點擊要測試的節點
3. 點擊 "Execute Node"
4. 檢查輸出結果

### 2. 測試完整工作流程

1. 點擊 "Execute Workflow"
2. 觀察每個節點的執行狀態
3. 檢查最終輸出

### 3. 使用 Webhook 手動觸發

```bash
curl -X POST http://localhost:5678/webhook/steam-trigger \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 監控與維護

### 查看執行歷史

在 n8n UI 中：
1. 前往 "Executions"
2. 查看執行記錄
3. 檢查錯誤日誌

### 查看統計資料

工作流程會自動記錄：
- 處理的項目數量
- 去重統計
- 分類分布
- 執行時間

### 錯誤處理

如果工作流程失敗：
1. 檢查 Error Trigger 節點的輸出
2. 查看錯誤日誌
3. 修正問題後重新執行

## 常見問題

### Q: RSS Feed 無法讀取
A: 檢查 RSS URL 是否正確，確認網站可訪問

### Q: OpenAI API 錯誤
A: 檢查 API key 是否有效，確認配額未超限

### Q: Google Sheets 寫入失敗
A: 檢查 OAuth 認證是否過期，重新授權

### Q: LINE 通知未發送
A: 檢查 Channel Access Token 是否正確，確認 Bot 已加入群組

## 進階配置

### 自定義去重閾值

修改 `deduplication.js` 中的配置：

```javascript
const config = {
  titleSimilarityThreshold: 0.85,  // 標題相似度閾值
  contentSimilarityThreshold: 0.90, // 內容相似度閾值
  timeWindowDays: 7                 // 時間窗口（天）
};
```

### 自定義 AI 提示詞

修改 `ai-classification.js` 中的系統提示詞以調整分類邏輯。

### 添加新的資料來源

1. 在工作流程中添加新的 RSS Feed 或 HTTP Request 節點
2. 連接到 "資料正規化" 節點
3. 測試並驗證

## 效能優化

### 減少 API 呼叫

- 使用批次處理
- 啟用快取機制
- 設定合理的執行頻率

### 提高處理速度

- 使用並行處理
- 優化 Function 節點代碼
- 減少不必要的資料轉換

## 備份與恢復

### 備份工作流程

```bash
# 匯出工作流程
curl -X GET http://localhost:5678/api/v1/workflows/{workflow_id} \
  -H "X-N8N-API-KEY: your-api-key" \
  > backup.json
```

### 恢復工作流程

```bash
# 匯入工作流程
curl -X POST http://localhost:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: your-api-key" \
  -H "Content-Type: application/json" \
  -d @backup.json
```
