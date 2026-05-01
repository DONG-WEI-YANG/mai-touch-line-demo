#!/usr/bin/env python3
"""
NLP Service Setup Script
Creates virtual environment and installs dependencies
"""
import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run shell command and handle errors"""
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error: {e.stderr}")
        return False

def main():
    print("🚀 Setting up NLP Service...")
    
    # Get current directory
    service_dir = Path(__file__).parent
    venv_dir = service_dir / "venv"
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    
    # Create virtual environment
    if not venv_dir.exists():
        print("📦 Creating virtual environment...")
        if not run_command(f"python -m venv venv", cwd=service_dir):
            print("❌ Failed to create virtual environment")
            sys.exit(1)
        print("✅ Virtual environment created")
    else:
        print("✅ Virtual environment already exists")
    
    # Determine activation script
    if os.name == 'nt':  # Windows
        activate_script = venv_dir / "Scripts" / "activate.bat"
        pip_path = venv_dir / "Scripts" / "pip.exe"
    else:  # Unix/Linux/Mac
        activate_script = venv_dir / "bin" / "activate"
        pip_path = venv_dir / "bin" / "pip"
    
    # Install dependencies
    print("📦 Installing dependencies...")
    if not run_command(f'"{pip_path}" install --upgrade pip', cwd=service_dir):
        print("❌ Failed to upgrade pip")
        sys.exit(1)
    
    if not run_command(f'"{pip_path}" install -r requirements.txt', cwd=service_dir):
        print("❌ Failed to install dependencies")
        sys.exit(1)
    
    print("✅ Dependencies installed")
    
    # Download models
    print("📥 Downloading NLP models...")
    download_script = service_dir / "download_models.py"
    if download_script.exists():
        python_path = venv_dir / ("Scripts" if os.name == 'nt' else "bin") / "python"
        if not run_command(f'"{python_path}" download_models.py', cwd=service_dir):
            print("⚠️  Model download failed, will download on first run")
    
    print("\n🎉 Setup complete!")
    print("\nNext steps:")
    if os.name == 'nt':
        print("1. Activate: .\\venv\\Scripts\\activate")
    else:
        print("1. Activate: source venv/bin/activate")
    print("2. Run: python main.py")
    print("3. API docs: http://localhost:8000/docs")

if __name__ == "__main__":
    main()
