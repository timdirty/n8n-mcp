#!/bin/bash

# STEAM 工作流程完整系統測試腳本
# Conceived by Romuald Członkowski - www.aiadvisors.pl/en

set -e

echo "🧪 STEAM 工作流程完整系統測試"
echo "================================"
echo ""

# 顏色定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 測試計數器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 測試函數
test_file() {
    local file=$1
    local description=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $description"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌${NC} $description"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

test_json() {
    local file=$1
    local description=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ]; then
        if jq empty "$file" 2>/dev/null; then
            echo -e "${GREEN}✅${NC} $description"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}❌${NC} $description (JSON 格式錯誤)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        echo -e "${RED}❌${NC} $description (檔案不存在)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

test_js() {
    local file=$1
    local description=$2
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ -f "$file" ]; then
        if node -c "$file" 2>/dev/null; then
            echo -e "${GREEN}✅${NC} $description"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            echo -e "${RED}❌${NC} $description (語法錯誤)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        echo -e "${RED}❌${NC} $description (檔案不存在)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 1. 核心功能檔案測試
echo "📦 1. 核心功能檔案測試"
echo "----------------------"
test_js "functions/deduplication.js" "去重機制函數"
test_js "functions/ai-classification.js" "AI 分類函數"
test_js "functions/line-flex-message.js" "LINE Flex Message 函數"
echo ""

# 2. 工作流程檔案測試
echo "🔄 2. 工作流程檔案測試"
echo "----------------------"
test_json "workflows/steam-complete-workflow.json" "完整工作流程 JSON"
echo ""

# 3. 配置檔案測試
echo "⚙️  3. 配置檔案測試"
echo "-------------------"
test_json "config/data-sources.json" "資料來源配置"
test_json "config/keywords.json" "STEAM 關鍵字配置"
test_json "config/line-groups.json" "LINE 群組配置"
echo ""

# 4. Schema 檔案測試
echo "📋 4. Schema 檔案測試"
echo "--------------------"
test_json "schemas/competition-schema.json" "比賽資料 Schema"
test_json "schemas/google-sheets-schema.json" "Google Sheets Schema"
test_json "schemas/topic-templates.json" "主題模板 Schema"
echo ""

# 5. 腳本檔案測試
echo "🔧 5. 腳本檔案測試"
echo "------------------"
test_file "scripts/deploy.sh" "部署腳本"
test_js "scripts/create-workflow.js" "工作流程建立腳本"
test_js "scripts/data-normalizer.js" "資料正規化腳本"
test_js "scripts/message-formatter.js" "訊息格式化腳本"
test_file "scripts/test-complete-system.sh" "系統測試腳本"
echo ""

# 6. 後台管理測試
echo "🖥️  6. 後台管理測試"
echo "-------------------"
test_file "backend/admin-dashboard.html" "後台管理介面"
echo ""

# 7. 文檔測試
echo "📚 7. 文檔測試"
echo "-------------"
test_file "README.md" "README 文檔"
test_file "QUICKSTART.md" "快速開始指南"
test_file "DEPLOYMENT_CHECKLIST.md" "部署檢查清單"
test_file "docs/architecture.md" "架構文檔"
test_file "docs/usage-guide.md" "使用指南"
echo ""

# 8. 工作流程結構測試
echo "🏗️  8. 工作流程結構測試"
echo "----------------------"
if [ -f "workflows/steam-complete-workflow.json" ]; then
    node_count=$(jq '.nodes | length' workflows/steam-complete-workflow.json)
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$node_count" -ge 10 ]; then
        echo -e "${GREEN}✅${NC} 工作流程節點數量: $node_count (≥10)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌${NC} 工作流程節點數量: $node_count (<10)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    connection_count=$(jq '.connections | length' workflows/steam-complete-workflow.json)
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if [ "$connection_count" -ge 1 ]; then
        echo -e "${GREEN}✅${NC} 工作流程連接數量: $connection_count (≥1)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌${NC} 工作流程連接數量: $connection_count (<1)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
fi
echo ""

# 9. 去重機制測試
echo "🔍 9. 去重機制測試"
echo "-----------------"
if [ -f "functions/deduplication.js" ]; then
    # 檢查關鍵函數是否存在
    for func in "calculateHash" "levenshteinDistance" "calculateSimilarity" "calculateTFIDF" "cosineSimilarity" "checkDuplication"; do
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        if grep -q "function $func" functions/deduplication.js || grep -q "const $func" functions/deduplication.js; then
            echo -e "${GREEN}✅${NC} 函數存在: $func"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌${NC} 函數缺失: $func"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    done
fi
echo ""

# 10. AI 分類測試
echo "🤖 10. AI 分類測試"
echo "-----------------"
if [ -f "functions/ai-classification.js" ]; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if grep -q "gpt-4o-mini" functions/ai-classification.js; then
        echo -e "${GREEN}✅${NC} GPT-4o-mini 模型配置"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌${NC} GPT-4o-mini 模型配置缺失"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    if grep -q "STEAM" functions/ai-classification.js; then
        echo -e "${GREEN}✅${NC} STEAM 分類邏輯"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌${NC} STEAM 分類邏輯缺失"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
fi
echo ""

# 11. LINE Flex Message 測試
echo "💬 11. LINE Flex Message 測試"
echo "----------------------------"
if [ -f "functions/line-flex-message.js" ]; then
    for func in "createFlexMessage" "createCarouselMessage"; do
        TOTAL_TESTS=$((TOTAL_TESTS + 1))
        if grep -q "function $func" functions/line-flex-message.js || grep -q "const $func" functions/line-flex-message.js; then
            echo -e "${GREEN}✅${NC} 函數存在: $func"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌${NC} 函數缺失: $func"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    done
fi
echo ""

# 測試總結
echo "================================"
echo "📊 測試總結"
echo "================================"
echo "總測試數: $TOTAL_TESTS"
echo -e "${GREEN}通過: $PASSED_TESTS${NC}"
echo -e "${RED}失敗: $FAILED_TESTS${NC}"
echo ""

# 計算通過率
if [ $TOTAL_TESTS -gt 0 ]; then
    pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "通過率: ${pass_rate}%"
    echo ""
    
    if [ $pass_rate -eq 100 ]; then
        echo -e "${GREEN}🎉 所有測試通過！系統準備就緒！${NC}"
        exit 0
    elif [ $pass_rate -ge 90 ]; then
        echo -e "${YELLOW}⚠️  大部分測試通過，但仍有少數問題需要修復${NC}"
        exit 1
    else
        echo -e "${RED}❌ 多個測試失敗，請檢查並修復問題${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 無法執行測試${NC}"
    exit 1
fi
