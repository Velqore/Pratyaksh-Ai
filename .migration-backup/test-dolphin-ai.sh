#!/bin/bash

echo "🧪 Dolphin AI Integration Test Suite"
echo "===================================="

BASE_URL="http://localhost:8080"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_test() {
    echo -e "\n🧪 Testing: $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_failure() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Test 1: Check server is running
print_test "Server connectivity"
if curl -s "$BASE_URL/api/ping" > /dev/null; then
    print_success "Server is running"
else
    print_failure "Server is not running. Start with: npm run dev"
    exit 1
fi

# Test 2: Check AI status
print_test "Dolphin AI status"
STATUS_RESPONSE=$(curl -s "$BASE_URL/api/chat/status")
if echo "$STATUS_RESPONSE" | grep -q '"success":true'; then
    print_success "Chat API is accessible"
    
    # Check if AI is available
    if echo "$STATUS_RESPONSE" | grep -q '"available":true'; then
        print_success "Dolphin AI is available and ready"
    else
        print_warning "Dolphin AI is not available (may need setup)"
        echo "AI Status Response:"
        echo "$STATUS_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$STATUS_RESPONSE"
    fi
else
    print_failure "Chat API is not working"
    echo "Response: $STATUS_RESPONSE"
fi

# Test 3: Simple AI chat test
print_test "Basic AI chat functionality"
CHAT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/test" \
    -H "Content-Type: application/json" \
    -d '{"message": "Hello, please respond with a brief forensic analysis greeting."}')

if echo "$CHAT_RESPONSE" | grep -q '"success":true'; then
    print_success "AI chat is working"
    
    # Extract and show the AI response
    AI_MESSAGE=$(echo "$CHAT_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['data']['message'][:200] + '...' if len(data['data']['message']) > 200 else data['data']['message'])" 2>/dev/null)
    if [ ! -z "$AI_MESSAGE" ]; then
        echo "AI Response: $AI_MESSAGE"
    fi
else
    print_warning "AI chat test failed (may work with manual setup)"
    echo "Response: $CHAT_RESPONSE"
fi

# Test 4: Forensic chat with context
print_test "Forensic chat with evidence context"
FORENSIC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/forensic" \
    -H "Content-Type: application/json" \
    -d '{
        "message": "What are the key factors in fingerprint minutiae analysis?",
        "evidenceType": "fingerprint"
    }')

if echo "$FORENSIC_RESPONSE" | grep -q '"success":true'; then
    print_success "Forensic chat is working"
    
    # Check confidence level
    CONFIDENCE=$(echo "$FORENSIC_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(f\"{data['data']['confidence']*100:.1f}%\")" 2>/dev/null)
    if [ ! -z "$CONFIDENCE" ]; then
        echo "AI Confidence: $CONFIDENCE"
    fi
else
    print_warning "Forensic chat test failed"
    echo "Response: $FORENSIC_RESPONSE"
fi

# Test 5: Enhanced chat analysis
print_test "Enhanced chat analysis"
ENHANCED_RESPONSE=$(curl -s -X POST "$BASE_URL/api/chat/analyze" \
    -H "Content-Type: application/json" \
    -d '{
        "message": "Explain the analysis results",
        "evidenceType": "fingerprint",
        "analysisResult": {
            "pattern_type": "Ulnar Loop",
            "minutiae_count": 15,
            "quality_score": 8,
            "confidence_score": 92
        }
    }')

if echo "$ENHANCED_RESPONSE" | grep -q '"success":true'; then
    print_success "Enhanced analysis is working"
else
    print_warning "Enhanced analysis test failed"
    echo "Response: $ENHANCED_RESPONSE"
fi

# Test 6: Check Ollama service directly
print_test "Ollama service connectivity"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    print_success "Ollama service is running"
    
    # Check available models
    MODELS=$(curl -s http://localhost:11434/api/tags | python3 -c "import sys, json; data=json.load(sys.stdin); print(', '.join([m['name'] for m in data.get('models', [])]))" 2>/dev/null)
    if [ ! -z "$MODELS" ]; then
        echo "Available models: $MODELS"
    fi
else
    print_warning "Ollama service is not running"
    echo "Start with: ollama serve"
fi

# Summary
echo ""
echo "📋 Test Summary"
echo "==============="
echo "✅ Tests completed"
echo "📊 Check results above for any issues"
echo ""
echo "🔧 If tests failed:"
echo "1. Ensure server is running: npm run dev"
echo "2. Setup Ollama: ./setup-dolphin-ai.sh"
echo "3. Check logs for detailed error messages"
echo ""
echo "🎯 Ready to use Dolphin AI in Pratyaksh Forensic System!"