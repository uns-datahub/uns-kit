#!/bin/bash

set -euo pipefail

# Navigate to the project root
cd "$(dirname "$0")/.."

# Detect OS and set python & venv paths
PLATFORM="$(uname)"
if [[ "$PLATFORM" == "Linux" || "$PLATFORM" == "Darwin" ]]; then
  PYTHON_EXEC="python3"
  VENV_DIR="venv"
  VENV_ACTIVATE="./venv/bin/activate"
elif [[ "$PLATFORM" =~ MINGW.* || "$PLATFORM" =~ CYGWIN.* || "$PLATFORM" == "MSYS_NT"* ]]; then
  PYTHON_EXEC="python"
  VENV_DIR="venv"
  VENV_ACTIVATE="./venv/Scripts/activate"
else
  echo "[setup] Unsupported OS: $PLATFORM"
  exit 1
fi

# Check if Python is available
if ! command -v "$PYTHON_EXEC" &> /dev/null; then
  echo "[setup] Error: $PYTHON_EXEC not found in PATH."
  exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  echo "[setup] Creating virtual environment in $VENV_DIR..."
  "$PYTHON_EXEC" -m venv "$VENV_DIR"
fi

# Create gen directory if it doesn't exist
if [ ! -d "gen" ]; then
  echo "[setup] Creating gen directory..."
  mkdir -p gen
fi

# Ensure gen is a package for imports
if [ ! -f "gen/__init__.py" ]; then
  echo "[setup] Creating gen/__init__.py..."
  echo "# generated" > gen/__init__.py
fi

# Activate the virtual environment
echo "[setup] Activating virtual environment..."
source "$VENV_ACTIVATE"

# Install Python dependencies using pip from venv
echo "[setup] Installing requirements using pip from venv..."
"$PYTHON_EXEC" -m pip install --upgrade pip
"$PYTHON_EXEC" -m pip install -r requirements.txt

# Generate Python gRPC code from the proto file
echo "[setup] Generating gRPC Python code..."
"$PYTHON_EXEC" -m grpc_tools.protoc \
  -I=proto \
  --python_out=gen \
  --grpc_python_out=gen \
  proto/uns-gateway.proto

echo "[setup] Setup complete!"
