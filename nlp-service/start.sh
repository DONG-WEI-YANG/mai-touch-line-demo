#!/bin/bash
# NLP Service Startup Script (Linux/Mac)

echo "🚀 Starting m'AI Touch NLP Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found"
    echo "Please run: python3 setup.py"
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Check if models are downloaded
if [ ! -d "models/cache" ]; then
    echo "📥 Downloading models..."
    python download_models.py
fi

# Start the service
echo "🌐 Starting API server on http://localhost:8000"
python main.py
