@echo off
REM m'AI Touch - 項目設置腳本 (Windows)

echo 🚀 m'AI Touch 項目設置開始...

REM 檢查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 錯誤: 未安裝 Node.js
    echo 請訪問 https://nodejs.org/ 安裝 Node.js
    exit /b 1
)

echo ✅ Node.js 已安裝

REM 檢查 npm
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 錯誤: 未安裝 npm
    exit /b 1
)

echo ✅ npm 已安裝

REM 安裝依賴
echo 📦 安裝項目依賴...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo ❌ 依賴安裝失敗
    exit /b 1
)

echo ✅ 依賴安裝完成

REM 檢查環境變量文件
if not exist .env (
    echo ⚙️  創建環境變量文件...
    copy .env.example .env
    echo ✅ 已創建 .env 文件，請編輯並填入實際配置
) else (
    echo ✅ .env 文件已存在
)

REM 創建必要的目錄
echo 📁 創建必要的目錄...
if not exist logs mkdir logs
if not exist uploads mkdir uploads
if not exist tmp mkdir tmp

echo ✅ 目錄創建完成

echo.
echo 🎉 設置完成！
echo.
echo 下一步：
echo 1. 編輯 .env 文件，填入實際配置
echo 2. 確保 MySQL 數據庫已啟動
echo 3. 運行 'npm run dev:server' 啟動後端
echo 4. 在新終端運行 'npm start' 啟動前端
echo.
echo 📚 查看文檔: docs\DEVELOPMENT.md

pause
