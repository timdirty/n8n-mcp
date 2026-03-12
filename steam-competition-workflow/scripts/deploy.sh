#!/bin/bash

# STEAM 工作流程自動部署腳本

set -e

echo "🚀 STEAM 工作流程自動部署"
echo "================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 檢查 n8n 運行狀態
echo "1️⃣ 檢查 n8n 運行狀態..."
if curl -s http://localhost:5678/healthz | grep -q "ok"; then
    echo -e "${GREEN}✓ n8n 運行正常${NC}"
else
    echo -e "${RED}✗ n8n 未運行，請先啟動 n8n${NC}"
    exit 1
fi
echo ""

# 檢查必要檔案
echo "2️⃣ 檢查必要檔案..."
FILES=(
    "workflows/steam-complete-workflow.json"
    "functions/deduplication.js"
    "functions/ai-classification.js"
    "functions/line-flex-message.js"
    "backend/admin-dashboard.html"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file 不存在"
        exit 1
    fi
done
echo ""

# 驗證 JSON 格式
echo "3️⃣ 驗證工作流程 JSON..."
if jq empty workflows/steam-complete-workflow.json 2>/dev/null; then
    echo -e "${GREEN}✓ JSON 格式正確${NC}"
else
    echo -e "${RED}✗ JSON 格式錯誤${NC}"
    exit 1
fi
echo ""

# 顯示工作流程資訊
echo "4️⃣ 工作流程資訊..."
WORKFLOW_NAME=$(jq -r '.name' workflows/steam-complete-workflow.json)
NODE_COUNT=$(jq '.nodes | length' workflows/steam-complete-workflow.json)
echo "   名稱: $WORKFLOW_NAME"
echo "   節點數量: $NODE_COUNT"
echo ""

# 建立備份
echo "5️⃣ 建立備份..."
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r workflows functions backend "$BACKUP_DIR/"
echo -e "${GREEN}✓ 備份已建立: $BACKUP_DIR${NC}"
echo ""

# 部署說明
echo "6️⃣ 部署步驟..."
echo ""
echo -e "${YELLOW}由於 n8n API Key 未配置，請手動完成以下步驟：${NC}"
echo ""
echo "📋 步驟 1：匯入工作流程"
echo "   1. 訪問 http://localhost:5678"
echo "   2. 登入（admin / admin123）"
echo "   3. 點擊右上角 '+' > 'Import from File'"
echo "   4. 選擇: $(pwd)/workflows/steam-complete-workflow.json"
echo ""

echo "🔐 步驟 2：配置認證"
echo "   前往 Credentials，配置以下認證："
echo "   - Google Sheets OAuth2 API"
echo "   - LINE Messaging API"
echo "   - OpenAI API"
echo "   - Notion API (可選)"
echo ""

echo "⚙️  步驟 3：更新節點配置"
echo "   在匯入的工作流程中更新："
echo "   - Google Sheets 節點：設定 Spreadsheet ID"
echo "   - LINE 節點：選擇已配置的認證"
echo "   - OpenAI 節點：選擇已配置的認證"
echo ""

echo "🧪 步驟 4：測試工作流程"
echo "   1. 點擊 'Execute Workflow' 按鈕"
echo "   2. 檢查每個節點的執行結果"
echo "   3. 確認資料正確寫入 Google Sheets"
echo "   4. 確認 LINE 通知正常發送"
echo ""

echo "📊 步驟 5：開啟後台管理"
echo "   在瀏覽器中開啟："
echo "   file://$(pwd)/backend/admin-dashboard.html"
echo ""

echo -e "${GREEN}✅ 部署準備完成！${NC}"
echo ""
echo "💡 提示：完成上述步驟後，工作流程將每 6 小時自動執行一次。"
echo "   您也可以使用 Webhook 手動觸發："
echo "   curl -X POST http://localhost:5678/webhook/steam-trigger"
echo ""

