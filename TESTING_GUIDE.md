# Testing Guide - SEO Content Generation System

This guide provides step-by-step instructions for testing the entire application flow.

## Prerequisites

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Start Required Services**
   ```bash
   # Start Redis (if not running)
   docker run -d -p 6379:6379 redis:alpine
   
   # Or if using Supabase, ensure connection is configured
   ```

4. **Start the Application**
   ```bash
   npm run start:dev
   ```

   You should see:
   ```
   Application is running on: http://localhost:3000
   ```

## Testing Flow

### Phase 1: Keyword Research

#### Test 1.1: Get Keyword Suggestions

```bash
curl -X POST http://localhost:3000/api/keywords/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "seedKeyword": "digital marketing"
  }'
```

**Expected Response:**
```json
{
  "suggestions": [
    {
      "keyword": "digital marketing strategies",
      "difficulty": 45,
      "difficultyLevel": "MEDIUM",
      "searchVolume": 12000,
      "cpc": 2.5,
      "competition": 0.75
    },
    {
      "keyword": "digital marketing tools",
      "difficulty": 38,
      "difficultyLevel": "MEDIUM",
      ...
    }
  ]
}
```

**Save a keyword ID** from the response (or create one manually if needed).

#### Test 1.2: Get Keyword Details (Optional)

```bash
curl http://localhost:3000/api/keywords/{keyword-id}
```

---

### Phase 2: Create Draft & Strategy Analysis

#### Test 2.1: Create Draft

```bash
curl -X POST http://localhost:3000/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "keywordId": "your-keyword-id-here"
  }'
```

**Expected Response:**
```json
{
  "id": "draft-uuid",
  "title": "digital marketing strategies",
  "status": "RESEARCHING",
  "primaryKeywordId": "keyword-uuid",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Save the draft ID** - you'll need it for subsequent requests.

**What Happens Next:**
- Draft status automatically changes to `ANALYZING`
- Background worker fetches SERP data
- Worker scrapes competitor headings
- Worker analyzes gaps using LLM
- Status changes to `OUTLINE_PENDING`
- Outline is generated automatically

#### Test 2.2: Check Draft Status (Polling)

```bash
curl http://localhost:3000/api/drafts/{draft-id}
```

**Check the status field:**
- `RESEARCHING` → Draft just created
- `ANALYZING` → Strategy analysis in progress
- `OUTLINE_PENDING` → Strategy complete, outline generated, waiting for approval
- `OUTLINE_APPROVED` → User approved, content generation started
- `WRITING` → Content generation in progress
- `COMPLETED` → All done!

**Expected Response (when OUTLINE_PENDING):**
```json
{
  "id": "draft-uuid",
  "title": "digital marketing strategies",
  "status": "OUTLINE_PENDING",
  "strategy": {
    "targetFormat": "How-to Guide",
    "informationGainAngle": "Focus on practical implementation steps...",
    "competitorHeadings": ["Heading 1", "Heading 2", ...],
    "serpData": {
      "organic": [...],
      "peopleAlsoAsk": [...]
    }
  },
  "outline": {
    "title": "Complete Guide to Digital Marketing Strategies in 2024",
    "sections": [
      {
        "heading": "Introduction to Digital Marketing",
        "intent": "Provide overview and context",
        "keywordsToInclude": ["digital marketing", "strategies"]
      },
      ...
    ]
  }
}
```

---

### Phase 3: Review & Approve Outline

#### Test 3.1: Review Outline (Already done in 2.2)

The outline is automatically generated. Check it in the draft response.

#### Test 3.2: Edit Outline (Optional)

If you want to modify the outline before approval:

```bash
curl -X PUT http://localhost:3000/api/drafts/{draft-id}/outline \
  -H "Content-Type: application/json" \
  -d '{
    "outline": {
      "title": "Your Custom Title",
      "sections": [
        {
          "heading": "Custom Section 1",
          "intent": "Custom intent",
          "keywordsToInclude": ["keyword1", "keyword2"]
        }
      ]
    }
  }'
```

#### Test 3.3: Approve Outline

```bash
curl -X PUT http://localhost:3000/api/drafts/{draft-id}/approve-outline
```

**Expected Response:**
```json
{
  "id": "draft-uuid",
  "status": "OUTLINE_APPROVED",
  ...
}
```

**What Happens Next:**
- Status changes to `WRITING`
- Background worker generates introduction
- Worker generates each section sequentially
- Worker generates conclusion
- Content is compiled
- SEO score is calculated
- Status changes to `COMPLETED`

---

### Phase 4: Monitor Content Generation

#### Test 4.1: Poll Draft Status

```bash
# Run this multiple times to see progress
curl http://localhost:3000/api/drafts/{draft-id}
```

**Watch for:**
- Status: `WRITING` → Content generation in progress
- `sections` array growing as sections are added
- Status: `COMPLETED` → All done!

**Expected Response (when COMPLETED):**
```json
{
  "id": "draft-uuid",
  "title": "Complete Guide to Digital Marketing Strategies in 2024",
  "status": "COMPLETED",
  "content": "# Complete Guide to Digital Marketing Strategies in 2024\n\n...",
  "sections": [
    {
      "id": "section-uuid-1",
      "heading": "Complete Guide to Digital Marketing Strategies in 2024",
      "content": "Introduction content...",
      "order": 0,
      "type": "introduction"
    },
    {
      "id": "section-uuid-2",
      "heading": "Introduction to Digital Marketing",
      "content": "Section content...",
      "order": 1,
      "type": "section"
    },
    ...
  ],
  "seoScore": {
    "keywordInH1": true,
    "keywordInFirstParagraph": true,
    "keywordInH2": true,
    "entityDensity": 2.5,
    "wordCount": 2150
  }
}
```

---

### Phase 5: Export Final Content

#### Test 5.1: Export Draft

```bash
curl http://localhost:3000/api/drafts/{draft-id}/export
```

**Expected Response:**
```json
{
  "id": "draft-uuid",
  "title": "Complete Guide to Digital Marketing Strategies in 2024",
  "content": "# Complete Guide to Digital Marketing Strategies in 2024\n\n[Full markdown content...]",
  "format": "markdown",
  "exportedAt": "2024-01-01T12:00:00.000Z"
}
```

---

## Additional Testing

### Test: List All Drafts

```bash
curl http://localhost:3000/api/drafts
```

**Expected Response:**
```json
[
  {
    "id": "draft-uuid-1",
    "title": "Article 1",
    "status": "COMPLETED",
    ...
  },
  {
    "id": "draft-uuid-2",
    "title": "Article 2",
    "status": "WRITING",
    ...
  }
]
```

### Test: Check Application Health

```bash
# Check if server is running
curl http://localhost:3000/api/drafts
```

---

## Testing with Postman

### Import Collection

Create a Postman collection with these requests:

1. **Get Keyword Suggestions**
   - Method: `POST`
   - URL: `http://localhost:3000/api/keywords/suggest`
   - Body (JSON):
     ```json
     {
       "seedKeyword": "digital marketing"
     }
     ```

2. **Create Draft**
   - Method: `POST`
   - URL: `http://localhost:3000/api/drafts`
   - Body (JSON):
     ```json
     {
       "keywordId": "{{keywordId}}"
     }
     ```
   - Save `id` as variable `{{draftId}}`

3. **Get Draft Status**
   - Method: `GET`
   - URL: `http://localhost:3000/api/drafts/{{draftId}}`
   - Use this to poll status

4. **Approve Outline**
   - Method: `PUT`
   - URL: `http://localhost:3000/api/drafts/{{draftId}}/approve-outline`

5. **Export Draft**
   - Method: `GET`
   - URL: `http://localhost:3000/api/drafts/{{draftId}}/export`

---

## Testing Script (Automated)

Create `test-flow.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
SEED_KEYWORD="digital marketing"

echo "=== Phase 1: Keyword Research ==="
echo "Getting keyword suggestions..."
KEYWORD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/keywords/suggest" \
  -H "Content-Type: application/json" \
  -d "{\"seedKeyword\": \"$SEED_KEYWORD\"}")

echo "$KEYWORD_RESPONSE" | jq '.'
KEYWORD_ID=$(echo "$KEYWORD_RESPONSE" | jq -r '.suggestions[0].keyword' | head -1)

echo -e "\n=== Phase 2: Create Draft ==="
echo "Creating draft with keyword..."
DRAFT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/drafts" \
  -H "Content-Type: application/json" \
  -d "{\"keywordId\": \"$KEYWORD_ID\"}")

echo "$DRAFT_RESPONSE" | jq '.'
DRAFT_ID=$(echo "$DRAFT_RESPONSE" | jq -r '.id')

echo -e "\n=== Phase 3: Monitor Status ==="
echo "Draft ID: $DRAFT_ID"
echo "Polling status (waiting for OUTLINE_PENDING)..."

while true; do
  STATUS=$(curl -s "$BASE_URL/api/drafts/$DRAFT_ID" | jq -r '.status')
  echo "Current status: $STATUS"
  
  if [ "$STATUS" = "OUTLINE_PENDING" ]; then
    echo "Outline ready!"
    break
  fi
  
  sleep 5
done

echo -e "\n=== Phase 4: Approve Outline ==="
curl -s -X PUT "$BASE_URL/api/drafts/$DRAFT_ID/approve-outline" | jq '.'

echo -e "\n=== Phase 5: Wait for Completion ==="
echo "Waiting for content generation..."

while true; do
  STATUS=$(curl -s "$BASE_URL/api/drafts/$DRAFT_ID" | jq -r '.status')
  echo "Current status: $STATUS"
  
  if [ "$STATUS" = "COMPLETED" ]; then
    echo "Content generation complete!"
    break
  fi
  
  sleep 10
done

echo -e "\n=== Phase 6: Export ==="
curl -s "$BASE_URL/api/drafts/$DRAFT_ID/export" | jq '.content' | head -20

echo -e "\n=== Test Complete ==="
```

Make it executable:
```bash
chmod +x test-flow.sh
./test-flow.sh
```

---

## Testing Individual Components

### Test DataForSEO Service

```bash
# This is called internally, but you can test the endpoint
curl -X POST http://localhost:3000/api/keywords/suggest \
  -H "Content-Type: application/json" \
  -d '{"seedKeyword": "test keyword"}'
```

### Test SERP Fetching

This happens in the background worker. Check logs:
```bash
# In your terminal where the app is running, you should see:
# "Fetching SERP data for keyword: ..."
# "Scraping competitor headings..."
# "Analyzing content gaps..."
```

### Test LLM Generation

This also happens in background. Monitor logs for:
- "Generating introduction..."
- "Generating section 1/8: ..."
- "Generating conclusion..."
- "Calculating SEO score..."

---

## Common Issues & Solutions

### Issue: Draft stuck in RESEARCHING

**Solution:**
- Check if Redis is running: `docker ps | grep redis`
- Check worker logs for errors
- Verify BullMQ queues are processing jobs

### Issue: Status not updating

**Solution:**
- Check database connection (Supabase/PostgreSQL)
- Verify workers are running (check logs)
- Check for errors in worker processors

### Issue: Outline not generated

**Solution:**
- Check OpenAI API key is set correctly
- Verify strategy was saved (check draft.strategy field)
- Check worker logs for LLM errors

### Issue: Content generation fails

**Solution:**
- Check OpenAI API quota/limits
- Verify outline exists and is valid
- Check worker logs for specific errors

---

## Monitoring & Debugging

### Check Application Logs

```bash
# Logs show each phase:
# [StrategyProcessor] Processing strategy analysis...
# [StrategyProcessor] Fetching SERP data...
# [OutlineProcessor] Processing outline generation...
# [ContentProcessor] Generating introduction...
```

### Check Database

```bash
# Connect to Supabase/PostgreSQL
# Check drafts table:
SELECT id, title, status, created_at FROM drafts ORDER BY created_at DESC;

# Check sections:
SELECT draft_id, heading, type, "order" FROM sections ORDER BY draft_id, "order";
```

### Check Redis/BullMQ

```bash
# Connect to Redis
redis-cli

# Check queue status
KEYS bull:*
LLEN bull:strategy:waiting
LLEN bull:outline:waiting
LLEN bull:content:waiting
```

---

## Performance Testing

### Test Concurrent Drafts

```bash
# Create multiple drafts simultaneously
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/drafts \
    -H "Content-Type: application/json" \
    -d "{\"keywordId\": \"keyword-id-$i\"}" &
done
wait
```

### Test Large Content Generation

Use a keyword that will generate many sections:
```bash
curl -X POST http://localhost:3000/api/keywords/suggest \
  -H "Content-Type: application/json" \
  -d '{"seedKeyword": "comprehensive guide"}'
```

---

## Expected Timings

- **Keyword Suggestions**: 2-5 seconds
- **Strategy Analysis**: 30-60 seconds
  - SERP fetch: 2-3 seconds
  - Competitor scraping: 10-20 seconds
  - LLM gap analysis: 15-30 seconds
- **Outline Generation**: 10-20 seconds
- **Content Generation**: 2-5 minutes
  - Introduction: 10-15 seconds
  - Each section: 15-30 seconds
  - Conclusion: 10-15 seconds
  - Compilation & scoring: 1-2 seconds

**Total Time**: ~3-7 minutes per article

---

## Next Steps

1. **Set up monitoring**: Add logging/monitoring tools
2. **Add tests**: Create unit and integration tests
3. **Error handling**: Test error scenarios
4. **Load testing**: Test with multiple concurrent requests
5. **Production testing**: Test with real API keys and production database

