#!/usr/bin/env node

/**
 * 使用 n8n API 建立 STEAM 工作流程
 */

const fs = require('fs');
const path = require('path');

// 讀取工作流程 JSON
const workflowPath = path.join(__dirname, '../workflows/steam-complete-workflow.json');
const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

console.log('📋 STEAM 工作流程建立腳本');
console.log('================================\n');

console.log('✅ 工作流程 JSON 已載入');
console.log(`   名稱: ${workflow.name}`);
console.log(`   節點數量: ${workflow.nodes.length}`);
console.log(`   觸發器數量: ${workflow.triggerCount || 2}`);
console.log('');

console.log('📝 下一步操作：');
console.log('');
console.log('1. 在 n8n UI 中手動匯入工作流程：');
console.log('   - 訪問 http://localhost:5678');
console.log('   - 登入（admin / admin123）');
console.log('   - 點擊右上角 "+" > "Import from File"');
console.log('   - 選擇: steam-competition-workflow/workflows/steam-complete-workflow.json');
console.log('');

console.log('2. 配置必要的認證：');
console.log('   - Google Sheets OAuth2');
console.log('   - LINE Messaging API');
console.log('   - OpenAI API');
console.log('');

console.log('3. 更新節點配置：');
console.log('   - Google Sheets ID');
console.log('   - LINE Channel Access Token');
console.log('   - OpenAI API Key');
console.log('');

console.log('4. 測試工作流程：');
console.log('   - 點擊 "Execute Workflow"');
console.log('   - 檢查每個節點的輸出');
console.log('');

console.log('💡 提示：由於 n8n API Key 未配置，請使用 UI 手動匯入。');
console.log('');

