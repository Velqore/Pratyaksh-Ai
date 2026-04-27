#!/bin/bash
# Setup script for ChatGPT Pro integration

echo "🚀 Setting up ChatGPT Pro integration for Pratyaksh Forensic AI"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "📋 Current AI configuration:"
echo "  Primary AI: ChatGPT Pro (when API key provided)"
echo "  Fallback AI: TinyLlama (local)"
echo ""

# Check if OpenAI API key is already set
current_key=$(grep "^OPENAI_API_KEY=" .env | cut -d'=' -f2)

if [ "$current_key" = "your_openai_api_key_here" ] || [ -z "$current_key" ]; then
    echo "🔑 OpenAI API Key Setup Required"
    echo ""
    echo "To use ChatGPT Pro, you need an OpenAI API key:"
    echo "1. Go to: https://platform.openai.com/api-keys"
    echo "2. Create a new API key"
    echo "3. Copy the key and paste it when prompted"
    echo ""
    
    read -p "Enter your OpenAI API key (or press Enter to skip): " api_key
    
    if [ -n "$api_key" ]; then
        # Update the .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$api_key/" .env
        else
            # Linux
            sed -i "s/^OPENAI_API_KEY=.*/OPENAI_API_KEY=$api_key/" .env
        fi
        echo "✅ OpenAI API key configured successfully!"
        echo "🤖 ChatGPT Pro will be used as the primary AI"
    else
        echo "⚠️  Skipped OpenAI API key setup"
        echo "🤖 TinyLlama (local) will be used as the primary AI"
    fi
else
    echo "✅ OpenAI API key is already configured"
    echo "🤖 ChatGPT Pro will be used as the primary AI"
fi

echo ""
echo "🎯 Configuration Summary:"
echo "  - Fast responses: ChatGPT Pro (when API key provided)"
echo "  - Reliable fallback: Local TinyLlama + Professional responses"
echo "  - No downtime: Automatic fallback system ensures responses"
echo ""
echo "🚀 Ready to start the server with: npm run dev"