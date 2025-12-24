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

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Docker** (for Redis, optional if you have Redis installed locally)
- **PostgreSQL** (optional, if not using Supabase)

## Installation

### 1. Clone and Install Dependencies

```bash
# Install Node.js dependencies
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Copy the example file (if it exists) or create a new .env file
touch .env
```

#### Required Environment Variables

Add the following to your `.env` file:

```env
# Application Configuration
NODE_ENV=development
PORT=3002

# DataForSEO API Configuration
# Get your credentials from https://dataforseo.com
# You need either login/password OR auth_token (Base64 encoded login:password)
DATAFORSEO_LOGIN=your_dataforseo_login
DATAFORSEO_PASSWORD=your_dataforseo_password
# OR use auth token (Base64 encoded login:password)
DATAFORSEO_AUTH_TOKEN=your_base64_encoded_auth_token

# Google Gemini API Configuration
# Get your API key from https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key
# Optional: Specify Gemini model (default: gemini-3-pro-preview)
GEMINI_MODEL=gemini-3-pro-preview

# Database Configuration (Choose one option below)

# Option 1: Supabase (Recommended for production)
# Get connection strings from Supabase Dashboard → Settings → Database
SUPABASE_DB_DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
SUPABASE_DB_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
SUPABASE_SSL=true

# Optional: Supabase API credentials (for future features)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Option 2: Local PostgreSQL (Alternative)
# Uncomment and configure if using local PostgreSQL instead of Supabase
# DATABASE_HOST=localhost
# DATABASE_PORT=5432
# DATABASE_USER=postgres
# DATABASE_PASSWORD=your_postgres_password
# DATABASE_NAME=seo_content
# SUPABASE_SSL=false

# Redis Configuration (for BullMQ job queues)
REDIS_HOST=localhost
REDIS_PORT=6379
# Optional: If your Redis instance requires a password
# REDIS_PASSWORD=your_redis_password

# Optional: Database Connection Pool Settings
DB_POOL_MAX=20
DB_CONNECTION_TIMEOUT=5000
DB_IDLE_TIMEOUT=30000
```

#### How to Get API Keys

1. **DataForSEO API**:
   - Sign up at [https://dataforseo.com](https://dataforseo.com)
   - Navigate to your dashboard
   - Get your login credentials or generate an auth token
   - For auth token: Base64 encode `login:password` (e.g., `echo -n "login:password" | base64`)

2. **Google Gemini API**:
   - Visit [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Sign in with your Google account
   - Create a new API key
   - Copy the API key to `GEMINI_API_KEY`

3. **Supabase Database**:
   - Create a project at [https://supabase.com](https://supabase.com)
   - Go to Settings → Database
   - Copy the connection strings:
     - **Direct URL** (port 5432) → `SUPABASE_DB_DIRECT_URL`
     - **Pooler URL** (port 6543) → `SUPABASE_DB_URL`
   - See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions

### 3. Set Up Database

#### Option 1: Supabase (Recommended)

1. Create a project at [https://supabase.com](https://supabase.com)
2. Get your connection strings from Settings → Database
3. Add the connection strings to your `.env` file (see above)
4. The database schema will be automatically created on first run (if `NODE_ENV` is not `production`)

For detailed Supabase setup, see [SUPABASE_SETUP.md](./SUPABASE_SETUP.md).

#### Option 2: Local PostgreSQL

```bash
# Create the database
createdb seo_content

# Or using psql
psql -U postgres -c "CREATE DATABASE seo_content;"
```

Then configure your `.env` file with local PostgreSQL credentials (see Option 2 in the environment variables section above).

### 4. Set Up Redis

Redis is required for the BullMQ job queue system. Choose one of the following options:

#### Option 1: Docker (Recommended)

```bash
# Run Redis in a Docker container
docker run -d --name redis -p 6379:6379 redis:alpine

# To stop Redis
docker stop redis

# To start Redis again
docker start redis
```

#### Option 2: Local Installation

**macOS (using Homebrew):**

```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Windows:**

- Download Redis from [https://github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases)
- Or use WSL2 with the Ubuntu instructions above

### 5. Verify Setup

Before running the application, verify your setup:

```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check if PostgreSQL/Supabase connection is configured
# (The app will show connection errors on startup if not configured)
```

### 6. Run the Application

```bash
# Development mode (with hot reload)
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The application will start on `http://localhost:3002` (or the port specified in `PORT` environment variable).

**Note:** On first run, the database schema will be automatically created if `NODE_ENV` is not set to `production`.

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

## Environment Variables Reference

### Required Variables

| Variable                 | Description                                               | Example                    |
| ------------------------ | --------------------------------------------------------- | -------------------------- |
| `DATAFORSEO_LOGIN`       | DataForSEO account login                                  | `your_login@example.com`   |
| `DATAFORSEO_PASSWORD`    | DataForSEO account password                               | `your_password`            |
| `DATAFORSEO_AUTH_TOKEN`  | Base64 encoded auth token (alternative to login/password) | `base64(login:password)`   |
| `GEMINI_API_KEY`         | Google Gemini API key                                     | `AIza...`                  |
| `SUPABASE_DB_DIRECT_URL` | Supabase direct connection URL (recommended)              | `postgresql://postgres...` |
| `REDIS_HOST`             | Redis server hostname                                     | `localhost`                |
| `REDIS_PORT`             | Redis server port                                         | `6379`                     |

### Optional Variables

| Variable                | Description                                      | Default                |
| ----------------------- | ------------------------------------------------ | ---------------------- |
| `NODE_ENV`              | Environment mode (`development` or `production`) | `development`          |
| `PORT`                  | Application port                                 | `3002`                 |
| `GEMINI_MODEL`          | Gemini model to use                              | `gemini-3-pro-preview` |
| `SUPABASE_DB_URL`       | Supabase pooler connection URL                   | -                      |
| `SUPABASE_SSL`          | Enable SSL for database connection               | `true`                 |
| `REDIS_PASSWORD`        | Redis password (if required)                     | -                      |
| `DATABASE_HOST`         | PostgreSQL host (if not using Supabase)          | `localhost`            |
| `DATABASE_PORT`         | PostgreSQL port                                  | `5432`                 |
| `DATABASE_USER`         | PostgreSQL username                              | `postgres`             |
| `DATABASE_PASSWORD`     | PostgreSQL password                              | -                      |
| `DATABASE_NAME`         | PostgreSQL database name                         | `postgres`             |
| `DB_POOL_MAX`           | Maximum database connections                     | `20`                   |
| `DB_CONNECTION_TIMEOUT` | Connection timeout in milliseconds               | `5000`                 |
| `DB_IDLE_TIMEOUT`       | Idle timeout in milliseconds                     | `30000`                |

### Environment File Priority

The application loads environment variables from files in this order (later files override earlier ones):

1. `.env`
2. `.env.local` (if exists)

**Note:** Never commit `.env` or `.env.local` files to version control. They contain sensitive credentials.

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Error:** `Connection refused` or `ECONNREFUSED`

**Solutions:**

- Verify your Supabase connection string is correct
- Check if `SUPABASE_SSL=true` is set for Supabase connections
- For local PostgreSQL, ensure the database is running: `pg_isready`
- Verify database credentials in `.env`

#### 2. Redis Connection Errors

**Error:** `Redis connection failed` or `ECONNREFUSED 127.0.0.1:6379`

**Solutions:**

- Ensure Redis is running: `redis-cli ping` (should return `PONG`)
- Check `REDIS_HOST` and `REDIS_PORT` in `.env`
- If using Docker, verify the container is running: `docker ps | grep redis`
- For password-protected Redis, set `REDIS_PASSWORD` in `.env`

#### 3. DataForSEO API Errors

**Error:** `401 Unauthorized` or `Failed to fetch keyword suggestions`

**Solutions:**

- Verify `DATAFORSEO_LOGIN` and `DATAFORSEO_PASSWORD` are correct
- Or use `DATAFORSEO_AUTH_TOKEN` (Base64 encoded `login:password`)
- Check your DataForSEO account has sufficient credits
- Verify API access is enabled in your DataForSEO dashboard

#### 4. Gemini API Errors

**Error:** `API key not valid` or `403 Forbidden`

**Solutions:**

- Verify `GEMINI_API_KEY` is correct and not expired
- Check API quotas in Google Cloud Console
- Ensure the API key has access to Gemini models
- Try regenerating the API key if issues persist

#### 5. Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3002`

**Solutions:**

- Change the `PORT` in `.env` to a different port (e.g., `3003`)
- Or stop the process using the port:

  ```bash
  # Find process using port 3002
  lsof -i :3002  # macOS/Linux
  netstat -ano | findstr :3002  # Windows

  # Kill the process
  kill -9 <PID>  # macOS/Linux
  taskkill /PID <PID> /F  # Windows
  ```

#### 6. Database Schema Not Created

**Error:** Tables don't exist or migration errors

**Solutions:**

- Ensure `NODE_ENV` is not set to `production` (schema auto-creation is disabled in production)
- Check database connection is working
- Verify TypeORM has write permissions to the database
- Manually run migrations if needed (see database migration docs)

### Getting Help

If you encounter issues not covered here:

1. Check the application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure all prerequisites are installed and running
4. Review the [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for database-specific issues

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
