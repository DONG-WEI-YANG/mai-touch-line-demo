@echo off
REM NLP Service Startup Script (Windows)

echo 🚀 Starting m'AI Touch NLP Service...

REM Check if virtual environment exists
if not exist venv (
    echo ❌ Virtual environment not found
    echo Please run: python setup.py
    exit /b 1
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Check if models are downloaded
if not exist models\cache (
    echo 📥 Downloading models...
    python download_models.py
)

REM Start the service
echo 🌐 Starting API server on http://localhost:8000
python main.py

pause
