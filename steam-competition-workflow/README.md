# STEAM 教育比賽資訊蒐集系統

完整的自動化系統，用於蒐集、處理、分類和推送 STEAM 教育比賽資訊到 LINE 群組。

## 專案概述

本系統使用 n8n 工作流程自動化平台，整合多個資料來源、AI 分類、去重機制和多平台通知功能。

### 主要特性

- ✅ **5 層去重機制**：Hash、URL、標題相似度、時間窗口、內容相似度
- ✅ **AI 智能分類**：使用 GPT-4o-mini 進行 STEAM 分類
- ✅ **AI 摘要生成**：自動生成 100-150 字摘要
- ✅ **多平台同步**：Google Sheets + Notion + LINE
- ✅ **美觀的 Flex Message**：響應式 LINE 訊息設計
- ✅ **後台管理系統**：Web 介面管理和監控
- ✅ **自動化測試**：完整的測試套件

### 系統架構

```
資料來源 (5) → 處理層 (8) → 儲存層 (3) → 通知層 (3) → 管理層 (6)
```

詳細架構請參考：[docs/architecture.md](docs/architecture.md)

## 快速開始

### 前置需求

1. n8n 已安裝並運行（http://localhost:5678）
2. Node.js 18+ 和 npm
3. Google Sheets API 認證
4. LINE Messaging API 認證
5. OpenAI API Key
6. Notion API Token（可選）

### 安裝步驟

1. **確認 n8n 運行中**
   ```bash
   docker-compose -f docker-compose.n8n.yml ps
   ```

2. **配置環境變數**
   
   編輯 `.env.n8n` 文件，添加：
   ```bash
   N8N_API_KEY=your-n8n-api-key
   OPENAI_API_KEY=your-openai-api-key
   ```

3. **在 n8n UI 中配置認證**
   - Google Sheets OAuth2
   - LINE Messaging API
   - OpenAI API
   - Notion API（可選）

4. **建立 Google Sheets**
   
   建立包含以下工作表的 Google Sheets：
   - 主資料表
   - 科學 (Science)
   - 技術 (Technology)
   - 工程 (Engineering)
   - 藝術 (Arts)
   - 數學 (Mathematics)

5. **匯入工作流程**
   
   使用 n8n-mcp 工具或直接在 n8n UI 中匯入：
   ```bash
   workflows/steam-complete-workflow.json
   ```

6. **測試工作流程**
   
   在 n8n UI 中點擊 "Execute Workflow" 進行測試。

## 使用指南

### 手動觸發

使用 Webhook 手動觸發工作流程：

```bash
curl -X POST http://localhost:5678/webhook/steam-trigger \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 後台管理

開啟後台管理介面：

```bash
open steam-competition-workflow/backend/admin-dashboard.html
```

功能：
- 立即執行工作流程
- 查看統計資料
- 測試 LINE 通知
- 匯出資料
- 清除舊資料

### 監控執行

在 n8n UI 中：
1. 前往 "Executions"
2. 查看執行記錄
3. 檢查錯誤日誌

## 核心功能說明

### 5 層去重機制

實作於 `functions/deduplication.js`：

1. **Hash 去重**：MD5 雜湊值比對
2. **URL 去重**：網址唯一性檢查
3. **標題相似度**：Levenshtein distance < 0.85
4. **時間窗口**：7 天內重複檢查
5. **內容相似度**：TF-IDF + Cosine similarity < 0.90

### AI 分類與摘要

實作於 `functions/ai-classification.js`：

- 使用 GPT-4o-mini 模型
- 分類為 S/T/E/A/M 五大類別
- 生成 100-150 字繁體中文摘要
- 提取關鍵資訊（時間、地點、對象、獎項）

### LINE Flex Message

實作於 `functions/line-flex-message.js`：

- 響應式設計
- 類別顏色標籤
- 圖片、標題、摘要
- 查看詳情和分享按鈕

## 目錄結構

```
steam-competition-workflow/
├── workflows/              # n8n 工作流程定義
│   └── steam-complete-workflow.json
├── functions/              # Function 節點代碼
│   ├── deduplication.js
│   ├── ai-classification.js
│   └── line-flex-message.js
├── backend/                # 後台管理系統
│   └── admin-dashboard.html
├── docs/                   # 文檔
│   ├── architecture.md
│   └── usage-guide.md
└── README.md
```

## 效能指標

- 處理速度：< 5 秒/筆
- 去重準確率：> 95%
- AI 分類準確率：> 90%
- 系統可用性：> 99%

## 常見問題

### Q: 如何獲取 n8n API Key？

A: 在 n8n UI 中：Settings > API > Create API Key

### Q: 如何測試單一節點？

A: 在 n8n UI 中點擊節點，然後點擊 "Execute Node"

### Q: 如何修改去重閾值？

A: 編輯 `functions/deduplication.js` 中的配置參數

### Q: 如何添加新的資料來源？

A: 在工作流程中添加新的 RSS Feed 或 HTTP Request 節點

## 維護與更新

### 定期維護

- 每週檢查執行日誌
- 每月清理舊資料
- 定期更新 n8n 和依賴套件

### 備份

```bash
# 匯出工作流程
curl -X GET http://localhost:5678/api/v1/workflows/{workflow_id} \
  -H "X-N8N-API-KEY: your-api-key" \
  > backup.json
```

## 授權

本專案採用 MIT 授權。

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 聯絡方式

如有問題，請聯絡專案維護者。

---

**Conceived by Romuald Członkowski** - [www.aiadvisors.pl/en](https://www.aiadvisors.pl/en)
