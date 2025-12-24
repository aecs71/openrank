# Application Flow - SEO Content Generation System

This document explains the complete flow of the SEO content generation system from start to finish.

## Architecture Overview

```
┌─────────────┐
│   Client    │ (Frontend/API Consumer)
└──────┬──────┘
       │ HTTP Requests
       ▼
┌─────────────────────────────────────────────────┐
│           API Layer (NestJS)                    │
│  - KeywordsController                           │
│  - DraftsController                             │
└──────┬──────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│        Service Layer                            │
│  - KeywordsService                               │
│  - DraftsService                                │
└──────┬──────────────────────────────────────────┘
       │
       ├──────────────────┬──────────────────────┐
       ▼                  ▼                      ▼
┌─────────────┐  ┌──────────────┐    ┌──────────────┐
│  Supabase   │  │  BullMQ      │    │  External    │
│  (PostgreSQL)│  │  (Redis)     │    │  APIs        │
└─────────────┘  └──────┬───────┘    └──────┬───────┘
                        │                    │
                        ▼                    │
                 ┌───────────────────────────┘
                 │
                 ▼
         ┌──────────────────┐
         │  Worker Layer    │
         │  - Strategy      │
         │  - Outline       │
         │  - Content       │
         └──────────────────┘
```

## Complete Flow: Phase by Phase

### Phase 1: Keyword Research & Selection

**User Action:** Submit a seed keyword

```
1. POST /api/keywords/suggest
   └─> KeywordsController.suggestKeywords()
       └─> KeywordsService.suggestKeywords()
           └─> DataForSeoService.getKeywordSuggestions()
               └─> Calls DataForSEO Labs API
                   └─> Returns keyword suggestions with:
                       - Keyword text
                       - Difficulty (0-100)
                       - Difficulty Level (Low/Medium/High)
                       - Search Volume
                       - CPC, Competition
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
      ...
    }
  ]
}
```

**User Action:** Select a keyword and create draft

```
2. POST /api/drafts
   Body: { "keywordId": "uuid" }
   └─> DraftsController.createDraft()
       └─> DraftsService.createDraft()
           ├─> Validates keyword exists
           ├─> Creates Draft entity:
           │   - status: "RESEARCHING"
           │   - primaryKeywordId: keywordId
           │   - title: keyword text
           ├─> Saves to Supabase (PostgreSQL)
           └─> Queues job: 'analyze-strategy'
               └─> Adds to 'strategy' queue (BullMQ/Redis)
```

**Draft Status:** `RESEARCHING` → Automatically triggers Phase 2

---

### Phase 2: Strategy & Gap Analysis (Background Worker)

**Triggered:** Automatically when draft is created

```
StrategyProcessor.process() [Background Job]
│
├─> 1. Update Status
│   └─> DraftsService.updateStatus(draftId, "ANALYZING")
│
├─> 2. Fetch SERP Data
│   └─> DataForSeoService.getSearchResults(keyword)
│       └─> Calls DataForSEO API
│           └─> Returns:
│               - Top 10 organic results (title, snippet, link)
│               - People Also Ask questions
│               - Related searches
│
├─> 3. Scrape Competitor Headings
│   └─> For top 3 competitors:
│       └─> ScraperService.scrapeHeadings(url)
│           └─> Extracts H2/H3 headings from HTML
│               └─> Returns array of headings
│
├─> 4. LLM Gap Analysis
│   └─> LlmService.analyzeGap(keyword, competitors, PAA)
│       └─> Calls OpenAI API with prompt:
│           ├─> Analyzes competitor titles/snippets
│           ├─> Identifies dominant format:
│           │   - Listicle
│           │   - How-to Guide
│           │   - Deep-Dive Essay
│           │   - Comparison
│           │   - Tutorial
│           ├─> Finds "Information Gain Angle"
│           │   (What's missing that would provide unique value)
│           └─> Returns:
│               - targetFormat
│               - informationGainAngle
│               - recommendedApproach
│
└─> 5. Save Strategy & Trigger Outline
    └─> DraftsService.updateStrategy(draftId, strategy)
        ├─> Saves strategy JSON to draft:
        │   - targetFormat
        │   - informationGainAngle
        │   - competitorHeadings
        │   - serpData (organic, PAA, related)
        ├─> Updates status: "OUTLINE_PENDING"
        └─> Queues job: 'generate-outline'
            └─> Adds to 'outline' queue
```

**Draft Status:** `ANALYZING` → `OUTLINE_PENDING` → Automatically triggers Phase 3

---

### Phase 3: SEO Brief & Outline Generation (Background Worker)

**Triggered:** Automatically after strategy is saved

```
OutlineProcessor.process() [Background Job]
│
└─> LlmService.generateOutline(keyword, format, angle, PAA)
    └─> Calls OpenAI API with prompt:
        ├─> Uses targetFormat from strategy
        ├─> Incorporates informationGainAngle
        ├─> Answers People Also Ask questions
        └─> Returns structured JSON:
            {
              "title": "SEO-optimized title with keyword",
              "sections": [
                {
                  "heading": "H2 heading",
                  "intent": "what this section achieves",
                  "keywordsToInclude": ["keyword1", "keyword2"]
                },
                ...
              ]
            }
    │
    └─> DraftsService.updateOutline(draftId, outline)
        └─> Saves outline JSON to draft
```

**Draft Status:** `OUTLINE_PENDING` → **WAITING FOR USER APPROVAL**

**User Action:** Review and optionally edit outline

```
3. GET /api/drafts/:id
   └─> Returns draft with outline

4. PUT /api/drafts/:id/outline (Optional)
   Body: { "outline": { ...modified outline... } }
   └─> Updates outline if user wants to edit
```

**User Action:** Approve outline

```
5. PUT /api/drafts/:id/approve-outline
   └─> DraftsService.approveOutline(draftId)
       ├─> Validates outline exists
       ├─> Updates status: "OUTLINE_APPROVED"
       └─> Queues job: 'generate-content'
           └─> Adds to 'content' queue
```

**Draft Status:** `OUTLINE_APPROVED` → Automatically triggers Phase 4

---

### Phase 4: Long-Form Content Generation (Background Worker)

**Triggered:** Automatically when outline is approved

```
ContentProcessor.process() [Background Job]
│
├─> 1. Update Status
│   └─> DraftsService.updateStatus(draftId, "WRITING")
│
├─> 2. Get Draft & Keyword
│   └─> DraftsService.findById(draftId)
│       └─> Retrieves draft with primaryKeyword
│
├─> 3. Generate Introduction
│   └─> LlmService.generateIntroduction(keyword, title, angle)
│       └─> Calls OpenAI API:
│           ├─> Includes keyword in first paragraph
│           ├─> Hooks reader with compelling opening
│           ├─> Explains unique value
│           └─> Returns: 150-200 word introduction
│       │
│       └─> DraftsService.appendContent()
│           └─> Creates Section entity:
│               - type: "introduction"
│               - order: 0
│               - heading: article title
│               - content: introduction text
│
├─> 4. Generate Sections (Sequential Loop)
│   └─> For each section in outline.sections:
│       │
│       ├─> LlmService.generateSection(
│       │     heading, intent, keywords,
│       │     previousSectionSummary, angle, title
│       │   )
│       │   └─> Calls OpenAI API:
│       │       ├─> Uses context from previous section
│       │       ├─> Includes specified keywords naturally
│       │       ├─> Addresses section intent
│       │       ├─> Maintains information gain angle
│       │       └─> Returns: 300-500 word section
│       │
│       └─> DraftsService.appendContent()
│           └─> Creates Section entity:
│               - type: "section"
│               - order: i + 1
│               - heading: section heading
│               - content: section text
│
├─> 5. Generate Conclusion
│   └─> Re-fetch draft to get all sections
│       └─> LlmService.generateConclusion(title, keyword, summary)
│           └─> Calls OpenAI API:
│               ├─> Summarizes key takeaways
│               ├─> Reinforces value proposition
│               ├─> Includes clear CTA
│               └─> Returns: 150-200 word conclusion
│           │
│           └─> DraftsService.appendContent()
│               └─> Creates Section entity:
│                   - type: "conclusion"
│                   - order: sections.length + 1
│
├─> 6. Compile Final Content
│   └─> DraftsService.findById(draftId)
│       └─> Retrieves all sections
│           └─> Sorts by order
│           └─> Formats as markdown:
│               - Introduction: # Title\n\ncontent
│               - Sections: ## Heading\n\ncontent
│               - Conclusion: ## Conclusion\n\ncontent
│           └─> DraftsService.updateContent(draftId, finalContent)
│               ├─> Saves compiled markdown to draft.content
│               └─> Updates status: "COMPLETED"
│
└─> 7. Calculate SEO Score
    └─> SeoScoringService.calculateScore(content, keyword, strategy)
        ├─> Checks keyword in H1: ✅/❌
        ├─> Checks keyword in first paragraph: ✅/❌
        ├─> Checks keyword in at least one H2: ✅/❌
        ├─> Calculates entity density: %
        ├─> Counts total words
        └─> DraftsService.updateSeoScore(draftId, seoScore)
            └─> Saves SEO score JSON to draft
```

**Draft Status:** `WRITING` → `COMPLETED`

---

### Phase 5: Export Final Content

**User Action:** Export the completed article

```
6. GET /api/drafts/:id/export
   └─> DraftsController.exportDraft()
       └─> DraftsService.findById(draftId)
           └─> Returns:
               {
                 "id": "draft-uuid",
                 "title": "Article Title",
                 "content": "Full markdown content...",
                 "format": "markdown",
                 "exportedAt": "2024-01-01T00:00:00.000Z"
               }
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  1. POST /api/keywords/suggest   │
        │     Input: seedKeyword           │
        │     Output: keyword suggestions  │
        └───────────────┬───────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  2. POST /api/drafts              │
        │     Input: keywordId              │
        │     Output: draft (RESEARCHING)   │
        └───────────────┬───────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────────────────┐
        │         BACKGROUND WORKERS (BullMQ)           │
        │                                                │
        │  ┌────────────────────────────────────────┐   │
        │  │ StrategyProcessor                      │   │
        │  │ - Fetch SERP (Serper.dev)              │   │
        │  │ - Scrape competitors                   │   │
        │  │ - LLM gap analysis                     │   │
        │  │ Output: strategy (ANALYZING →         │   │
        │  │         OUTLINE_PENDING)               │   │
        │  └──────────────┬─────────────────────────┘   │
        │                 │                              │
        │                 ▼                              │
        │  ┌────────────────────────────────────────┐   │
        │  │ OutlineProcessor                       │   │
        │  │ - LLM generates outline                │   │
        │  │ Output: outline (OUTLINE_PENDING)      │   │
        │  └──────────────┬─────────────────────────┘   │
        │                 │                              │
        │                 ▼                              │
        │  ┌────────────────────────────────────────┐   │
        │  │ ContentProcessor                       │   │
        │  │ - Generate intro                       │   │
        │  │ - Generate sections (sequential)        │   │
        │  │ - Generate conclusion                  │   │
        │  │ - Compile & score                      │   │
        │  │ Output: content (WRITING → COMPLETED)  │   │
        │  └────────────────────────────────────────┘   │
        └────────────────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  3. GET /api/drafts/:id            │
        │     Check status & review          │
        └───────────────┬───────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  4. PUT /api/drafts/:id/outline    │
        │     (Optional: Edit outline)       │
        └───────────────┬───────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  5. PUT /api/drafts/:id/           │
        │      approve-outline              │
        │     Triggers content generation   │
        └───────────────┬───────────────────┘
                        │
                        ▼
        ┌───────────────────────────────────┐
        │  6. GET /api/drafts/:id/export     │
        │     Get final markdown content     │
        └───────────────────────────────────┘
```

## Status Flow

```
RESEARCHING
    │
    ▼ (Auto: Draft created)
ANALYZING
    │
    ▼ (Auto: Strategy saved)
OUTLINE_PENDING
    │
    ▼ (User: Approve outline)
OUTLINE_APPROVED
    │
    ▼ (Auto: Content generation starts)
WRITING
    │
    ▼ (Auto: Content completed)
COMPLETED
```

## Key Components

### External Services

- **DataForSEO Labs API**: Keyword research and difficulty scores
- **Serper.dev API**: SERP data (organic results, PAA questions)
- **OpenAI API**: LLM for gap analysis, outline generation, and content writing
- **Web Scraping**: Competitor heading extraction

### Internal Services

- **Supabase (PostgreSQL)**: Data persistence
- **Redis/BullMQ**: Job queue management
- **TypeORM**: Database ORM

### Queue Jobs

1. **`strategy` queue**: SERP analysis and gap identification
2. **`outline` queue**: SEO outline generation
3. **`content` queue**: Multi-step content generation

## Best Practices Implemented

1. **Asynchronous Processing**: Heavy work done in background workers
2. **Status Tracking**: Clear status progression for monitoring
3. **Sequential Content Generation**: Context passed between sections
4. **User Approval Gate**: Outline must be approved before writing
5. **Connection Pooling**: Supabase best practices for database
6. **Error Handling**: Comprehensive error logging and handling

## Monitoring

- Check draft status: `GET /api/drafts/:id`
- View all drafts: `GET /api/drafts`
- Monitor queue jobs: BullMQ dashboard (if configured)
- Check logs: Application logs show each phase progress
