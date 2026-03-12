#!/bin/bash

# STEAM 工作流程完整測試套件

set -e

echo "🧪 STEAM 工作流程測試套件"
echo "================================"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

test_case() {
    local name="$1"
    local command="$2"
    
    echo -n "測試: ${name}... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ 通過${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}✗ 失敗${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "📡 測試 1：n8n 連線"
test_case "n8n 健康檢查" "curl -f -s http://localhost:5678/healthz | grep -q ok"
test_case "n8n UI 可訪問" "curl -f -s -o /dev/null http://localhost:5678"
echo ""

echo "📁 測試 2：檔案結構"
test_case "工作流程 JSON" "[ -f workflows/steam-complete-workflow.json ]"
test_case "去重函數" "[ -f functions/deduplication.js ]"
test_case "AI 分類函數" "[ -f functions/ai-classification.js ]"
test_case "LINE 訊息函數" "[ -f functions/line-flex-message.js ]"
test_case "後台管理介面" "[ -f backend/admin-dashboard.html ]"
test_case "部署腳本" "[ -x scripts/deploy.sh ]"
echo ""

echo "🔍 測試 3：JSON 格式驗證"
test_case "工作流程 JSON 格式" "jq empty workflows/steam-complete-workflow.json"
test_case "資料來源配置" "jq empty config/data-sources.json"
test_case "關鍵字配置" "jq empty config/keywords.json"
echo ""

echo "📊 測試 4：工作流程結構"
NODE_COUNT=$(jq '.nodes | length' workflows/steam-complete-workflow.json)
test_case "節點數量 >= 10" "[ $NODE_COUNT -ge 10 ]"
test_case "包含觸發器" "jq -e '.nodes[] | select(.type | contains(\"Trigger\"))' workflows/steam-complete-workflow.json"
test_case "包含連接關係" "jq -e '.connections' workflows/steam-complete-workflow.json"
echo ""

echo "🔧 測試 5：JavaScript 語法"
if command -v node &> /dev/null; then
    test_case "去重函數語法" "node -c functions/deduplication.js"
    test_case "AI 分類函數語法" "node -c functions/ai-classification.js"
    test_case "LINE 訊息函數語法" "node -c functions/line-flex-message.js"
else
    echo -e "${YELLOW}⚠ Node.js 未安裝，跳過 JS 語法檢查${NC}"
fi
echo ""

echo "📝 測試 6：文檔完整性"
test_case "README 存在" "[ -f README.md ]"
test_case "快速開始指南" "[ -f QUICKSTART.md ]"
test_case "架構文檔" "[ -f docs/architecture.md ]"
test_case "使用指南" "[ -f docs/usage-guide.md ]"
test_case "實作總結" "[ -f IMPLEMENTATION_SUMMARY.md ]"
test_case "專案完成報告" "[ -f PROJECT_COMPLETE.md ]"
echo ""

echo "🐳 測試 7：Docker 環境"
test_case "n8n 容器運行" "docker ps | grep -q n8n"
test_case "PostgreSQL 容器運行" "docker ps | grep -q postgres"
test_case "資料卷存在" "docker volume ls | grep -q n8n_data"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 測試結果摘要"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "通過: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "失敗: ${RED}${TESTS_FAILED}${NC}"
echo -e "總計: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有測試通過！系統已準備就緒。${NC}"
    echo ""
    echo "🚀 下一步："
    echo "   1. 執行部署腳本: ./scripts/deploy.sh"
    echo "   2. 在 n8n UI 中匯入工作流程"
    echo "   3. 配置必要的認證"
    echo "   4. 測試工作流程執行"
    exit 0
else
    echo -e "${RED}❌ 有 ${TESTS_FAILED} 個測試失敗${NC}"
    echo "請檢查錯誤並修正後重新測試。"
    exit 1
fi
