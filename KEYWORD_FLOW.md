# How to Get keywordId for Creating Drafts

## The Problem

The `POST /api/keywords/suggest` endpoint returns keyword suggestions from DataForSEO, but **these suggestions are NOT saved to the database**. 

To create a draft, you need a `keywordId` which must exist in the database as a `Keyword` entity.

## Solution: Two-Step Process

### Step 1: Get Keyword Suggestions

```bash
curl -X POST http://localhost:3002/api/keywords/suggest \
  -H "Content-Type: application/json" \
  -d '{"seedKeyword": "digital marketing"}'
```

**Response:**
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

### Step 2: Save a Keyword (NEW ENDPOINT)

Pick a suggestion and save it to the database:

```bash
curl -X POST http://localhost:3002/api/keywords \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "digital marketing strategies",
    "difficulty": 45,
    "difficultyLevel": "MEDIUM",
    "searchVolume": 12000,
    "metadata": {
      "cpc": 2.5,
      "competition": 0.75
    }
  }'
```

**Response:**
```json
{
  "id": "keyword-uuid-here",
  "keyword": "digital marketing strategies",
  "difficulty": 45,
  "difficultyLevel": "MEDIUM",
  "searchVolume": 12000,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Save the `id` field** - this is your `keywordId`!

### Step 3: Create Draft

Now use the `keywordId` to create a draft:

```bash
curl -X POST http://localhost:3002/api/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "keywordId": "keyword-uuid-here"
  }'
```

## Complete Flow Example

```bash
# 1. Get suggestions
SUGGESTIONS=$(curl -s -X POST http://localhost:3002/api/keywords/suggest \
  -H "Content-Type: application/json" \
  -d '{"seedKeyword": "digital marketing"}')

# 2. Extract first suggestion (using jq)
KEYWORD_TEXT=$(echo $SUGGESTIONS | jq -r '.suggestions[0].keyword')
DIFFICULTY=$(echo $SUGGESTIONS | jq -r '.suggestions[0].difficulty')
DIFFICULTY_LEVEL=$(echo $SUGGESTIONS | jq -r '.suggestions[0].difficultyLevel')
SEARCH_VOLUME=$(echo $SUGGESTIONS | jq -r '.suggestions[0].searchVolume')

# 3. Save keyword
KEYWORD_RESPONSE=$(curl -s -X POST http://localhost:3002/api/keywords \
  -H "Content-Type: application/json" \
  -d "{
    \"keyword\": \"$KEYWORD_TEXT\",
    \"difficulty\": $DIFFICULTY,
    \"difficultyLevel\": \"$DIFFICULTY_LEVEL\",
    \"searchVolume\": $SEARCH_VOLUME
  }")

KEYWORD_ID=$(echo $KEYWORD_RESPONSE | jq -r '.id')

# 4. Create draft
curl -X POST http://localhost:3002/api/drafts \
  -H "Content-Type: application/json" \
  -d "{\"keywordId\": \"$KEYWORD_ID\"}"
```

## Alternative: Simplified Endpoint (Future Enhancement)

You could also create a combined endpoint that:
1. Gets suggestions
2. Saves the selected keyword
3. Creates a draft
4. Returns the draft

But for now, use the two-step process above.

## Summary

**The Missing Step:**
- ❌ `POST /api/keywords/suggest` → Returns suggestions (not saved)
- ✅ `POST /api/keywords` → **NEW**: Saves a keyword to database
- ✅ `POST /api/drafts` → Creates draft using saved keyword ID

**Flow:**
1. Get suggestions → 2. Save keyword → 3. Create draft

