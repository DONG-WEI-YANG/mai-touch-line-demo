#!/bin/bash

# m'AI Touch - 項目設置腳本

echo "🚀 m'AI Touch 項目設置開始..."

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 未安裝 Node.js"
    echo "請訪問 https://nodejs.org/ 安裝 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 檢查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 錯誤: 未安裝 npm"
    exit 1
fi

echo "✅ npm 版本: $(npm -v)"

# 安裝依賴
echo "📦 安裝項目依賴..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依賴安裝失敗"
    exit 1
fi

echo "✅ 依賴安裝完成"

# 檢查環境變量文件
if [ ! -f .env ]; then
    echo "⚙️  創建環境變量文件..."
    cp .env.example .env
    echo "✅ 已創建 .env 文件，請編輯並填入實際配置"
else
    echo "✅ .env 文件已存在"
fi

# 創建必要的目錄
echo "📁 創建必要的目錄..."
mkdir -p logs
mkdir -p uploads
mkdir -p tmp

echo "✅ 目錄創建完成"

echo ""
echo "🎉 設置完成！"
echo ""
echo "下一步："
echo "1. 編輯 .env 文件，填入實際配置"
echo "2. 確保 MySQL 數據庫已啟動"
echo "3. 運行 'npm run dev:server' 啟動後端"
echo "4. 在新終端運行 'npm start' 啟動前端"
echo ""
echo "📚 查看文檔: docs/DEVELOPMENT.md"
