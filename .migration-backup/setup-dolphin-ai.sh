#!/bin/bash

echo "🐬 Pratyaksh Forensic AI - Dolphin AI Setup Script"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running on supported OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "Detected OS: ${MACHINE}"

# Step 1: Install Ollama
echo ""
echo "📦 Step 1: Installing Ollama..."

if command -v ollama &> /dev/null; then
    print_status "Ollama is already installed"
    ollama --version
else
    echo "Installing Ollama..."
    if [ "${MACHINE}" = "Mac" ]; then
        # macOS installation
        curl -fsSL https://ollama.ai/install.sh | sh
    elif [ "${MACHINE}" = "Linux" ]; then
        # Linux installation
        curl -fsSL https://ollama.ai/install.sh | sh
    else
        print_error "Unsupported operating system: ${MACHINE}"
        print_warning "Please install Ollama manually from https://ollama.ai"
        exit 1
    fi
    
    if command -v ollama &> /dev/null; then
        print_status "Ollama installed successfully"
    else
        print_error "Ollama installation failed"
        exit 1
    fi
fi

# Step 2: Start Ollama service
echo ""
echo "🚀 Step 2: Starting Ollama service..."

# Check if Ollama is already running
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_status "Ollama service is already running"
else
    echo "Starting Ollama service..."
    
    # Start Ollama in background
    if [ "${MACHINE}" = "Mac" ]; then
        # On macOS, Ollama should auto-start
        ollama serve &
        sleep 3
    elif [ "${MACHINE}" = "Linux" ]; then
        # On Linux, start as background process
        nohup ollama serve > /dev/null 2>&1 &
        sleep 3
    fi
    
    # Verify service is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        print_status "Ollama service started successfully"
    else
        print_error "Failed to start Ollama service"
        print_warning "Try running 'ollama serve' manually in another terminal"
        exit 1
    fi
fi

# Step 3: Pull Dolphin model
echo ""
echo "📥 Step 3: Pulling Dolphin AI model..."

# Check if model is already available
if ollama list | grep -q "dolphin-mistral"; then
    print_status "Dolphin model is already available"
    ollama list | grep dolphin
else
    echo "Downloading Dolphin model (this may take several minutes)..."
    
    # Try to pull the model
    if ollama pull dolphin-mistral:latest; then
        print_status "Dolphin model downloaded successfully"
    else
        print_warning "Failed to download full model, trying smaller version..."
        if ollama pull dolphin-mistral:7b-v2.8; then
            print_status "Dolphin 7B model downloaded successfully"
            
            # Update environment to use 7B model
            if [ -f ".env" ]; then
                sed -i.bak 's/DOLPHIN_MODEL=dolphin-mistral:latest/DOLPHIN_MODEL=dolphin-mistral:7b-v2.8/' .env
                print_status "Updated .env to use 7B model"
            fi
        else
            print_error "Failed to download Dolphin model"
            print_warning "You may need to try a different model or check your internet connection"
            exit 1
        fi
    fi
fi

# Step 4: Verify installation
echo ""
echo "🧪 Step 4: Testing installation..."

# Test Ollama API
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_status "Ollama API is accessible"
else
    print_error "Ollama API is not accessible"
    exit 1
fi

# Test model availability
MODEL_NAME=$(grep DOLPHIN_MODEL .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "dolphin-mistral:latest")
if ollama list | grep -q "${MODEL_NAME%:*}"; then
    print_status "Dolphin model is ready: ${MODEL_NAME}"
else
    print_error "Dolphin model not found: ${MODEL_NAME}"
    exit 1
fi

# Step 5: Display success message and instructions
echo ""
echo "🎉 Dolphin AI Setup Complete!"
echo "=============================="
print_status "Ollama service is running on http://localhost:11434"
print_status "Dolphin AI model is ready for use"
print_status "All environment variables are configured"

echo ""
echo "📋 Next Steps:"
echo "1. Start your development server: npm run dev"
echo "2. Test the AI chat at: http://localhost:8080/api/chat/status"
echo "3. Try the chat interface in your Pratyaksh application"

echo ""
echo "🔧 Useful Commands:"
echo "• Check Ollama status: ollama list"
echo "• Stop Ollama: pkill ollama"
echo "• Start Ollama: ollama serve"
echo "• Update model: ollama pull dolphin-mistral:latest"

echo ""
echo "🆘 Troubleshooting:"
echo "• If Ollama stops working, restart it: ollama serve"
echo "• Check API status: curl http://localhost:11434/api/tags"
echo "• View Ollama logs: journalctl -u ollama (Linux) or Console app (Mac)"

print_status "Setup completed successfully! 🐬"