# SEO Content Generation System

A headless SEO content generation system with multi-phase workflow using NestJS, BullMQ, Supabase (PostgreSQL), and Redis.

## System Architecture

- **API Layer (NestJS)**: Handles user requests and job status polling
- **Worker Layer (BullMQ)**: Executes external API calls and LLM prompts
- **Redis/BullMQ**: Orchestrates the multi-step "Content Flow"
- **Supabase (PostgreSQL)**: Persists the state of "Article Drafts" with connection pooling and best practices

## Features

### Phase 1: Keyword Research & Selection
- POST `/api/keywords/suggest` - Get keyword suggestions from DataForSEO
- Automatic difficulty mapping (Low/Medium/High)
- Creates draft with status "RESEARCHING"

### Phase 2: Strategy & Gap Analysis
- SERP analysis using Serper.dev
- Format identification (Listicles, How-to Guides, Deep-Dive Essays)
- Competitor heading scraping
- Information gain angle identification

### Phase 3: SEO Brief & Outline Generation
- LLM-generated structured JSON outline
- User-editable before approval
- Keyword-optimized sections with intent mapping

### Phase 4: Long-Form Content Generation
- Multi-step sequential writing process
- Introduction generation
- Section-by-section content creation
- Conclusion with CTA

### Phase 5: On-Page SEO Scoring & Export
- Keyword presence validation
- Entity density calculation
- GET `/api/drafts/:id/export` - Export final content

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Set up Supabase (recommended) or PostgreSQL:
```bash
# Option 1: Supabase (Recommended)
# 1. Create project at https://supabase.com
# 2. Get connection string from Settings → Database
# 3. Add to .env file (see SUPABASE_SETUP.md)

# Option 2: Local PostgreSQL
createdb seo_content
```

4. Set up Redis (if not running):
```bash
# Using Docker
docker run -d -p 6379:6379 redis:alpine
```

5. Run the application:
```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

### Keywords
- `POST /api/keywords/suggest` - Get keyword suggestions
  ```json
  {
    "seedKeyword": "your seed keyword"
  }
  ```

- `GET /api/keywords/:id` - Get keyword details

### Drafts
- `POST /api/drafts` - Create a new draft
  ```json
  {
    "keywordId": "keyword-uuid"
  }
  ```

- `GET /api/drafts` - List all drafts
- `GET /api/drafts/:id` - Get draft details
- `PUT /api/drafts/:id/outline` - Update outline
- `PUT /api/drafts/:id/approve-outline` - Approve outline and trigger content generation
- `GET /api/drafts/:id/export` - Export final content

## Workflow

1. **Keyword Research**: User submits seed keyword → Get suggestions → Select keyword → Create draft
2. **Strategy Analysis**: Worker fetches SERP → Scrapes competitors → Analyzes gaps → Saves strategy
3. **Outline Generation**: Worker generates outline → User reviews/edits → User approves
4. **Content Generation**: Worker writes intro → Writes sections sequentially → Writes conclusion → Calculates SEO score
5. **Export**: User exports final markdown content

## Environment Variables

See `.env.example` for all required environment variables.

### Supabase Setup (Recommended)

For Supabase integration, see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed setup instructions.

**Quick Start:**
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your connection string from Settings → Database
3. Add to `.env`:
   ```env
   SUPABASE_DB_DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   SUPABASE_SSL=true
   ```

## Queue Jobs

The system uses three BullMQ queues:

- `strategy` - Handles SERP analysis and gap identification
- `outline` - Generates SEO-optimized outlines
- `content` - Generates long-form content section by section

## Database Schema

- `keywords` - Keyword data with difficulty scores
- `drafts` - Article drafts with status, strategy, outline, and content
- `sections` - Individual sections of articles

## License

MIT

