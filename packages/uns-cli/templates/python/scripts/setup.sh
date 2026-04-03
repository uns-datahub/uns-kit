#!/bin/bash

set -euo pipefail

# Navigate to the project root
cd "$(dirname "$0")/.."

# Detect OS and set paths
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

if [[ "$PLATFORM" =~ MINGW.*|MSYS.*|CYGWIN.*|Windows_NT ]]; then
    UV_CMD="$HOME/.local/bin/uv.exe"
else
    UV_CMD="$HOME/.cargo/bin/uv"
fi

if [ ! -f "$UV_CMD" ]; then
    echo "[setup] uv not found. Installing it..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
else
    echo "[setup] uv already installed at $UV_CMD"
fi

# Create virtual environment using uv
if [ ! -d "$VENV_DIR" ]; then
  echo "[setup] Creating virtual environment in $VENV_DIR using uv..."
  "$UV_CMD" venv "$VENV_DIR"
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
if [[ "$PLATFORM" =~ MINGW.*|MSYS.*|CYGWIN.* ]]; then
    # Windows Git Bash / MSYS
    . "$VENV_ACTIVATE"
else
    # Linux / macOS
    source "$VENV_ACTIVATE"
fi

# Install dependencies using uv (much faster than pip)
echo "[setup] Installing requirements using uv..."
"$UV_CMD" sync --active

# Generate Python gRPC code from proto
echo "[setup] Generating gRPC Python code..."
"$PYTHON_EXEC" -m grpc_tools.protoc \
  -I=proto \
  --python_out=gen \
  --grpc_python_out=gen \
  proto/uns-gateway.proto

  # Patch the generated _pb2_grpc.py to use relative imports
GRPC_FILE="gen/uns_gateway_pb2_grpc.py"
if [[ -f "$GRPC_FILE" ]]; then
    echo "[setup] Patching $GRPC_FILE to use relative imports..."
    if [[ "$PLATFORM" == "Linux" || "$PLATFORM" == "Darwin" ]]; then
        sed -i 's/^import \(.*_pb2\) as/from . import \1 as/' "$GRPC_FILE"
    elif [[ "$PLATFORM" =~ MINGW.*|MSYS.*|CYGWIN.* ]]; then
        sed -i'' 's/^import \(.*_pb2\) as/from . import \1 as/' "$GRPC_FILE"
    fi
fi

echo "[setup] Setup complete!"
