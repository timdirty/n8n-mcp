# 🚀 快速開始指南

5 分鐘快速部署 STEAM 比賽資訊蒐集系統（MVP 版本）

## 📝 前置準備清單

在開始之前，請準備好：

- [ ] Google 帳號
- [ ] LINE Developers 帳號
- [ ] n8n 環境（本地或雲端）
- [ ] 30 分鐘時間

---

## ⚡ 快速部署步驟

### 1️⃣ 建立 Google Sheets（5 分鐘）

```
1. 前往 https://sheets.google.com
2. 建立新試算表，命名「STEAM 比賽資訊」
3. 建立工作表「STEAM_Competitions」
4. 在第一列貼上欄位名稱：
   id | title | organizer | category | target_audience | registration_start | 
   registration_end | competition_date | location | description | url | 
   contact | prize | fee | source | scraped_at | status | hash_key | 
   sent_to_line | sent_at
5. 複製 Sheet ID（從 URL 中）
```

### 2️⃣ 設定 Google Service Account（10 分鐘）

```
1. 前往 https://console.cloud.google.com
2. 建立新專案「steam-competition-bot」
3. 啟用「Google Sheets API」
4. 建立 Service Account
5. 下載 JSON 金鑰
6. 將 Service Account Email 加入 Google Sheets（編輯權限）
```

### 3️⃣ 建立 LINE Bot（10 分鐘）

```
1. 前往 https://developers.line.biz/
2. 建立 Messaging API Channel
3. 取得 Channel Access Token
4. 掃描 QR Code 加 Bot 為好友
5. 建立群組並邀請 Bot
6. 取得 Group ID（使用 n8n Webhook 或 API）
```

### 4️⃣ 匯入 n8n Workflow（3 分鐘）

```
1. 開啟 n8n
2. Import from File → 選擇 workflows/mvp-version.json
3. 設定 Google Sheets Credential（上傳 JSON 金鑰）
4. 設定 LINE Credential（貼上 Access Token）
5. 更新節點中的 Sheet ID 和 Group ID
```

### 5️⃣ 測試執行（2 分鐘）

```
1. 點擊「Execute Workflow」
2. 檢查每個節點是否成功執行
3. 確認 Google Sheets 有新資料
4. 確認 LINE 群組收到訊息
5. 啟用 Workflow 定時執行
```

---

## 🎯 完成！

系統已經開始運作，每天早上 8:00 會自動：

✅ 蒐集 STEAM 比賽資訊  
✅ 標準化並去重  
✅ 儲存到 Google Sheets  
✅ 推播到 LINE 群組  

---

## 📊 驗證清單

- [ ] Google Sheets 有資料寫入
- [ ] LINE 群組收到訊息
- [ ] 資料格式正確
- [ ] 沒有錯誤訊息
- [ ] 定時觸發已啟用

---

## 🔧 自訂設定

### 修改執行時間

在 Schedule Trigger 節點中修改 Cron 表達式：
- 每天 8:00：`0 8 * * *`
- 每天 8:00 和 18:00：`0 8,18 * * *`
- 每 6 小時：`0 */6 * * *`

### 調整關鍵字

編輯 `config/keywords.json`：
```json
{
  "steam_keywords": {
    "general": ["STEAM", "科學", "競賽", "比賽"]
  }
}
```

### 修改訊息格式

編輯 `scripts/message-formatter.js` 中的 `formatTextMessage` 函數

---

## 📚 進階功能

準備好升級了嗎？

### 進階版本（多群組 + Flex Message）
```bash
# 匯入進階版 workflow
workflows/advanced-version.json

# 設定多個 LINE 群組
config/line-groups.json
```

### 完整版本（AI + 多通道）
```bash
# 匯入完整版 workflow
workflows/complete-version.json

# 設定 OpenAI API Key
OPENAI_API_KEY=your_key_here
```

---

## ❓ 遇到問題？

### 常見問題快速解決

**Q: Google Sheets 寫入失敗**
```
→ 檢查 Service Account 是否有編輯權限
→ 確認 Sheet ID 正確
```

**Q: LINE 推播失敗**
```
→ 檢查 Access Token 是否正確
→ 確認 Bot 在群組中
→ 驗證 Group ID
```

**Q: 沒有蒐集到資料**
```
→ 檢查資料源 URL 是否正常
→ 調整關鍵字設定
→ 查看錯誤日誌
```

詳細故障排除請參考：`docs/troubleshooting.md`

---

## 📖 完整文檔

- [README.md](README.md) - 專案概述
- [setup-guide.md](docs/setup-guide.md) - 詳細安裝指南
- [deployment-guide.md](docs/deployment-guide.md) - 部署指南
- [maintenance-guide.md](docs/maintenance-guide.md) - 維護指南

---

## 🎉 恭喜！

您已成功部署 STEAM 比賽資訊自動蒐集系統！

**下一步建議：**
1. 觀察系統運作 1-2 週
2. 根據實際需求調整關鍵字
3. 考慮升級到進階版本
4. 加入更多資料源

**享受自動化帶來的便利！** 🚀
