# STEAM 比賽資訊蒐集系統 - 安裝設定指南

## 📋 目錄

1. [前置需求](#前置需求)
2. [環境設定](#環境設定)
3. [Google Sheets 設定](#google-sheets-設定)
4. [LINE Bot 設定](#line-bot-設定)
5. [n8n Workflow 匯入](#n8n-workflow-匯入)
6. [測試與驗證](#測試與驗證)
7. [常見問題](#常見問題)

---

## 前置需求

### 必要服務

- **n8n** (版本 >= 1.0.0)
- **Google 帳號** (用於 Google Sheets)
- **LINE Developers 帳號** (用於 LINE Messaging API)
- **Node.js** (版本 >= 18.0.0，如果本地執行)

### 選配服務（進階功能）

- **OpenAI API Key** (用於 AI 分類和摘要)
- **Notion 帳號** (用於資料同步)
- **SMTP 服務** (用於 Email 通知)
- **Telegram Bot** (用於多通道推播)

---

## 環境設定

### 步驟 1：複製專案

```bash
git clone <repository-url>
cd steam-competition-workflow
```

### 步驟 2：設定環境變數

```bash
# 複製環境變數範例
cp config/.env.example .env

# 編輯環境變數
nano .env
```

### 步驟 3：填寫必要資訊

在 `.env` 檔案中填入以下資訊：

```env
# Google Sheets
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_GROUP_ID=your_line_group_id
```

---

## Google Sheets 設定

### 步驟 1：建立 Google Sheets

1. 前往 [Google Sheets](https://sheets.google.com)
2. 建立新的試算表
3. 命名為「STEAM 比賽資訊系統」

### 步驟 2：建立工作表

建立以下 4 個工作表：

#### 工作表 1：STEAM_Competitions

在第一列填入以下欄位名稱：

```
A: id
B: title
C: organizer
D: category
E: target_audience
F: registration_start
G: registration_end
H: competition_date
I: location
J: description
K: url
L: contact
M: prize
N: fee
O: source
P: scraped_at
Q: status
R: hash_key
S: sent_to_line
T: sent_at
```

#### 工作表 2：Error_Log

```
A: timestamp
B: execution_id
C: workflow_name
D: node_name
E: error_type
F: error_message
G: severity
H: resolved
I: resolved_at
J: notes
```

#### 工作表 3：Monitoring_Dashboard

```
A: date
B: execution_count
C: success_count
D: failure_count
E: success_rate
F: data_collected
G: new_data
H: dedup_rate
I: line_sent
J: line_success_rate
K: avg_execution_time
L: error_count
M: data_quality_score
```

#### 工作表 4：Review_Queue（進階版）

```
A: id
B: title
C: organizer
D: category
E: target_audience
F: registration_end
G: url
H: ai_confidence
I: review_status
J: reviewer
K: review_time
L: review_notes
M: auto_approve
```

### 步驟 3：設定資料驗證

在 `STEAM_Competitions` 工作表中：

1. 選擇 D 欄（category）
2. 資料 → 資料驗證
3. 條件：清單（來自範圍）
4. 輸入：Science, Technology, Engineering, Arts, Math, Mixed

重複以上步驟設定 E 欄（target_audience）：
- 輸入：國小, 國中, 高中, 大學, 全年齡

### 步驟 4：凍結列和欄

1. 選擇第 2 列第 1 欄（A2）
2. 檢視 → 凍結 → 1 列
3. 檢視 → 凍結 → 2 欄

### 步驟 5：取得 Sheet ID

從 Google Sheets URL 中複製 Sheet ID：
```
https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_SHEET_ID]/edit
```

### 步驟 6：設定 Service Account

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 建立新專案或選擇現有專案
3. 啟用 Google Sheets API
4. 建立 Service Account
5. 下載 JSON 金鑰檔案
6. 將 Service Account Email 加入 Google Sheets 的共用設定（編輯權限）

---

## LINE Bot 設定

### 步驟 1：建立 LINE Messaging API Channel

1. 前往 [LINE Developers Console](https://developers.line.biz/)
2. 登入或註冊帳號
3. 建立新的 Provider（如果還沒有）
4. 建立 Messaging API Channel

### 步驟 2：設定 Channel

1. 填寫 Channel 基本資訊：
   - Channel name: STEAM 比賽資訊 Bot
   - Channel description: 自動推播 STEAM 教育比賽資訊
   - Category: Education
   - Subcategory: Schools

2. 同意服務條款並建立

### 步驟 3：取得 Channel Access Token

1. 進入 Channel 設定頁面
2. 找到「Messaging API」分頁
3. 在「Channel access token」區域點擊「Issue」
4. 複製產生的 Token（長期有效）

### 步驟 4：設定 Webhook（選配）

如果需要接收使用者訊息：

1. 在「Messaging API」分頁找到「Webhook settings」
2. 輸入 Webhook URL（n8n 提供的 URL）
3. 啟用「Use webhook」

### 步驟 5：將 Bot 加入群組

1. 在 LINE Developers Console 找到 Bot 的 QR Code
2. 用手機掃描 QR Code 加入 Bot 為好友
3. 建立 LINE 群組並邀請 Bot 加入

### 步驟 6：取得 Group ID

方法 1：使用 n8n Webhook
```javascript
// 在 n8n 中建立 Webhook 節點
// 讓 Bot 在群組中發送任何訊息
// 從 Webhook 接收的資料中找到 groupId
```

方法 2：使用 LINE Bot SDK
```javascript
// 使用 LINE Messaging API 的 getProfile 端點
// 取得群組資訊
```

---

## n8n Workflow 匯入

### 步驟 1：選擇版本

根據需求選擇適合的版本：

- **MVP 版本**：基礎功能，快速上線（推薦新手）
- **進階版本**：多群組、Flex Message
- **完整版本**：AI 分類、多通道推播

### 步驟 2：匯入 Workflow

1. 開啟 n8n 介面
2. 點擊右上角「+」→「Import from File」
3. 選擇對應版本的 JSON 檔案：
   - `workflows/mvp-version.json`
   - `workflows/advanced-version.json`
   - `workflows/complete-version.json`

### 步驟 3：設定 Credentials

#### Google Sheets Credential

1. 點擊任一 Google Sheets 節點
2. 點擊「Credential to connect with」
3. 選擇「Create New」
4. 選擇「Service Account」
5. 上傳 JSON 金鑰檔案或貼上內容
6. 儲存

#### LINE Credential

1. 點擊 LINE 節點
2. 建立新的 HTTP Header Auth Credential
3. 設定：
   - Name: `Authorization`
   - Value: `Bearer YOUR_CHANNEL_ACCESS_TOKEN`
4. 儲存

### 步驟 4：更新節點設定

檢查並更新以下節點的設定：

1. **Schedule Trigger**：設定執行時間（預設每天 08:00）
2. **Google Sheets**：確認 Sheet ID 正確
3. **LINE Notify**：確認 Group ID 正確
4. **Code 節點**：檢查環境變數是否正確載入

---

## 測試與驗證

### 步驟 1：手動測試執行

1. 在 n8n 中開啟 Workflow
2. 點擊「Execute Workflow」手動執行
3. 觀察每個節點的執行結果
4. 檢查是否有錯誤訊息

### 步驟 2：驗證資料蒐集

1. 檢查是否成功從資料源取得資料
2. 確認資料標準化是否正確
3. 驗證去重邏輯是否運作

### 步驟 3：驗證 Google Sheets 寫入

1. 開啟 Google Sheets
2. 檢查 `STEAM_Competitions` 工作表
3. 確認有新資料寫入
4. 驗證欄位格式是否正確

### 步驟 4：驗證 LINE 推播

1. 檢查 LINE 群組
2. 確認收到推播訊息
3. 驗證訊息格式是否正確
4. 檢查連結是否可點擊

### 步驟 5：檢查錯誤日誌

1. 查看 `Error_Log` 工作表
2. 確認沒有嚴重錯誤
3. 如有錯誤，根據訊息進行修正

---

## 常見問題

### Q1: Google Sheets API 權限錯誤

**錯誤訊息**：`The caller does not have permission`

**解決方法**：
1. 確認 Service Account Email 已加入 Google Sheets 共用
2. 確認權限設定為「編輯者」
3. 重新整理 n8n Credential

### Q2: LINE 推播失敗

**錯誤訊息**：`Invalid access token`

**解決方法**：
1. 確認 Channel Access Token 是否正確
2. 檢查 Token 是否過期
3. 重新產生 Token 並更新設定

### Q3: 沒有蒐集到資料

**可能原因**：
1. 資料源 URL 錯誤或失效
2. 關鍵字設定過於嚴格
3. 網路連線問題

**解決方法**：
1. 檢查資料源 URL 是否可正常存取
2. 調整 `config/keywords.json` 中的關鍵字
3. 檢查網路連線和防火牆設定

### Q4: 重複資料過多

**解決方法**：
1. 檢查去重邏輯是否正常運作
2. 調整 `DEDUP_TIME_WINDOW_DAYS` 設定
3. 清理 Google Sheets 中的舊資料

### Q5: Workflow 執行時間過長

**解決方法**：
1. 減少資料源數量
2. 調整 `BATCH_SIZE` 設定
3. 優化 Code 節點的邏輯
4. 考慮使用平行處理

---

## 下一步

設定完成後，建議：

1. 閱讀 [部署指南](deployment-guide.md) 了解生產環境部署
2. 閱讀 [維護指南](maintenance-guide.md) 了解日常維護
3. 參考 [故障排除](troubleshooting.md) 解決常見問題

---

**需要協助？**

- 查看專案 README
- 參考完整規劃文件
- 提交 Issue 回報問題
