#!/bin/bash

# SEO Content Generation System - Automated Test Flow
# This script tests the complete flow from keyword research to content export

BASE_URL="http://localhost:3000"
SEED_KEYWORD="digital marketing"

echo "=========================================="
echo "SEO Content Generation - Test Flow"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq is not installed. Installing..."
    # For macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    # For Linux
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get install jq -y || sudo yum install jq -y
    fi
fi

# Check if server is running
echo -e "${BLUE}Checking if server is running...${NC}"
if ! curl -s "$BASE_URL/api/drafts" > /dev/null; then
    echo "❌ Server is not running. Please start it with: npm run start:dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Phase 1: Keyword Research
echo -e "${BLUE}=== Phase 1: Keyword Research ===${NC}"
echo "Getting keyword suggestions for: '$SEED_KEYWORD'..."
KEYWORD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/keywords/suggest" \
  -H "Content-Type: application/json" \
  -d "{\"seedKeyword\": \"$SEED_KEYWORD\"}")

if [ $? -ne 0 ]; then
    echo "❌ Failed to get keyword suggestions"
    exit 1
fi

SUGGESTIONS_COUNT=$(echo "$KEYWORD_RESPONSE" | jq '.suggestions | length')
if [ "$SUGGESTIONS_COUNT" -eq 0 ]; then
    echo "⚠️  No suggestions returned. This might be due to API key issues."
    echo "Response: $KEYWORD_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Received $SUGGESTIONS_COUNT keyword suggestions${NC}"
echo "First suggestion:"
echo "$KEYWORD_RESPONSE" | jq '.suggestions[0] | {keyword, difficulty, difficultyLevel, searchVolume}'

# For testing, we'll use the first keyword's text to create a keyword record
# In a real scenario, you'd save the keyword first
FIRST_KEYWORD=$(echo "$KEYWORD_RESPONSE" | jq -r '.suggestions[0].keyword')
echo ""
echo -e "${YELLOW}Note: In a real test, you would save the keyword first.${NC}"
echo -e "${YELLOW}For this test, we'll assume a keyword ID exists.${NC}"
echo ""
read -p "Enter a keyword ID to use (or press Enter to skip to draft creation): " KEYWORD_ID

if [ -z "$KEYWORD_ID" ]; then
    echo "⚠️  Skipping draft creation. Please create a keyword manually first."
    echo "You can test the flow by:"
    echo "1. Creating a keyword record in the database"
    echo "2. Using that keyword ID to create a draft"
    exit 0
fi

# Phase 2: Create Draft
echo ""
echo -e "${BLUE}=== Phase 2: Create Draft ===${NC}"
echo "Creating draft with keyword ID: $KEYWORD_ID"
DRAFT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/drafts" \
  -H "Content-Type: application/json" \
  -d "{\"keywordId\": \"$KEYWORD_ID\"}")

if [ $? -ne 0 ]; then
    echo "❌ Failed to create draft"
    exit 1
fi

DRAFT_ID=$(echo "$DRAFT_RESPONSE" | jq -r '.id')
if [ "$DRAFT_ID" == "null" ] || [ -z "$DRAFT_ID" ]; then
    echo "❌ Failed to get draft ID"
    echo "Response: $DRAFT_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ Draft created: $DRAFT_ID${NC}"
echo "Draft details:"
echo "$DRAFT_RESPONSE" | jq '{id, title, status, createdAt}'

# Phase 3: Monitor Status - Wait for OUTLINE_PENDING
echo ""
echo -e "${BLUE}=== Phase 3: Monitor Strategy & Outline Generation ===${NC}"
echo "Waiting for strategy analysis and outline generation..."
echo "This may take 30-90 seconds..."
echo ""

MAX_WAIT=120  # Maximum wait time in seconds
ELAPSED=0
POLL_INTERVAL=5

while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS_RESPONSE=$(curl -s "$BASE_URL/api/drafts/$DRAFT_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    
    echo -e "${YELLOW}Status: $STATUS (${ELAPSED}s elapsed)${NC}"
    
    case $STATUS in
        "RESEARCHING")
            echo "  → Draft created, waiting for strategy analysis..."
            ;;
        "ANALYZING")
            echo "  → Analyzing SERP and competitors..."
            ;;
        "OUTLINE_PENDING")
            echo -e "${GREEN}✓ Strategy complete! Outline generated.${NC}"
            echo ""
            echo "Outline preview:"
            echo "$STATUS_RESPONSE" | jq '.outline | {title, sections: .sections | length}'
            break
            ;;
        "OUTLINE_APPROVED")
            echo "  → Outline approved, content generation started..."
            ;;
        "WRITING")
            echo "  → Generating content..."
            ;;
        "COMPLETED")
            echo -e "${GREEN}✓ Content generation complete!${NC}"
            break
            ;;
        *)
            echo "  → Unknown status: $STATUS"
            ;;
    esac
    
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "⚠️  Timeout waiting for outline generation"
    echo "Current status: $STATUS"
    exit 1
fi

# Phase 4: Approve Outline
echo ""
echo -e "${BLUE}=== Phase 4: Approve Outline ===${NC}"
read -p "Press Enter to approve outline and start content generation..."
echo "Approving outline..."

APPROVE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/drafts/$DRAFT_ID/approve-outline")
if [ $? -ne 0 ]; then
    echo "❌ Failed to approve outline"
    exit 1
fi

echo -e "${GREEN}✓ Outline approved${NC}"
echo "Status: $(echo "$APPROVE_RESPONSE" | jq -r '.status')"

# Phase 5: Wait for Content Generation
echo ""
echo -e "${BLUE}=== Phase 5: Wait for Content Generation ===${NC}"
echo "This may take 2-5 minutes..."
echo ""

ELAPSED=0
MAX_WAIT=600  # 10 minutes max

while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS_RESPONSE=$(curl -s "$BASE_URL/api/drafts/$DRAFT_ID")
    STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
    SECTIONS_COUNT=$(echo "$STATUS_RESPONSE" | jq '.sections | length // 0')
    
    echo -e "${YELLOW}Status: $STATUS | Sections: $SECTIONS_COUNT (${ELAPSED}s elapsed)${NC}"
    
    if [ "$STATUS" == "COMPLETED" ]; then
        echo -e "${GREEN}✓ Content generation complete!${NC}"
        break
    fi
    
    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

if [ "$STATUS" != "COMPLETED" ]; then
    echo "⚠️  Content generation not completed within timeout"
    echo "Current status: $STATUS"
    exit 1
fi

# Phase 6: Export
echo ""
echo -e "${BLUE}=== Phase 6: Export Final Content ===${NC}"
echo "Exporting draft..."

EXPORT_RESPONSE=$(curl -s "$BASE_URL/api/drafts/$DRAFT_ID/export")
if [ $? -ne 0 ]; then
    echo "❌ Failed to export draft"
    exit 1
fi

echo -e "${GREEN}✓ Export successful${NC}"
echo ""
echo "Export details:"
echo "$EXPORT_RESPONSE" | jq '{id, title, format, exportedAt, contentLength: (.content | length)}'

echo ""
echo "Content preview (first 500 characters):"
echo "$EXPORT_RESPONSE" | jq -r '.content' | head -c 500
echo "..."
echo ""

# Show SEO Score
echo "SEO Score:"
FINAL_DRAFT=$(curl -s "$BASE_URL/api/drafts/$DRAFT_ID")
echo "$FINAL_DRAFT" | jq '.seoScore'

echo ""
echo -e "${GREEN}=========================================="
echo "✓ Test Flow Complete!"
echo "==========================================${NC}"
echo ""
echo "Draft ID: $DRAFT_ID"
echo "View full draft: curl $BASE_URL/api/drafts/$DRAFT_ID | jq"
echo ""

