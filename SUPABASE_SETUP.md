# Supabase Integration Guide

This guide explains how to set up and use Supabase with this SEO content generation system following best practices.

## Why Supabase?

Supabase is an open-source Firebase alternative built on PostgreSQL. It provides:

- **Managed PostgreSQL** with automatic backups
- **Connection pooling** for better performance
- **Real-time subscriptions** (optional, for future features)
- **Built-in authentication** (optional)
- **Storage** (optional, for future file uploads)
- **Edge Functions** (optional)

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the database to be provisioned (2-3 minutes)

### 2. Get Connection Strings

In your Supabase dashboard:

1. Go to **Settings** → **Database**
2. Find **Connection string** section
3. Copy the following:

#### For Server-Side (TypeORM) - **Use This One**

- **Connection pooling**: `Direct connection`
- **Connection string**: Copy the `URI` format
- This is your `SUPABASE_DB_DIRECT_URL`

#### For Client-Side (Optional)

- **Connection pooling**: `Session mode` or `Transaction mode`
- This is your `SUPABASE_DB_URL` (pooler URL)

### 3. Environment Variables

Create/update your `.env` file:

```env
# Supabase Database Connection (Recommended - Direct URL for server)
SUPABASE_DB_DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

# OR use individual parameters (fallback)
DATABASE_HOST=aws-0-[region].pooler.supabase.com
DATABASE_PORT=5432
DATABASE_USER=postgres.[project-ref]
DATABASE_PASSWORD=your-password
DATABASE_NAME=postgres

# SSL Configuration (required for Supabase)
SUPABASE_SSL=true

# Optional: Supabase API (for future features)
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Connection Pool Settings
DB_POOL_MAX=20
DB_CONNECTION_TIMEOUT=5000
DB_IDLE_TIMEOUT=30000
```

### 4. Connection String Format

Supabase connection strings follow this pattern:

```
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:[port]/postgres
```

**Important Notes:**

- **Direct connection** (port 5432): Use for server-side applications (TypeORM)
- **Pooler connection** (port 6543): Use for client-side applications
- Always use SSL/TLS for Supabase connections
- The password is your database password (not your Supabase account password)

## Best Practices

### 1. Use Direct Connection for Server-Side

✅ **Correct** (for TypeORM/NestJS):

```env
SUPABASE_DB_DIRECT_URL=postgresql://...@...:5432/postgres
```

❌ **Avoid** (pooler is for client connections):

```env
SUPABASE_DB_URL=postgresql://...@...:6543/postgres
```

### 2. Connection Pooling

The configuration includes connection pooling settings:

- **max**: Maximum connections (default: 20)
- **connectionTimeoutMillis**: Time to wait for connection (default: 5000ms)
- **idleTimeoutMillis**: Time before closing idle connections (default: 30000ms)

Adjust based on your traffic:

- Low traffic: `max: 10`
- Medium traffic: `max: 20` (default)
- High traffic: `max: 50-100`

### 3. SSL Configuration

Supabase requires SSL connections. The configuration automatically:

- Enables SSL for Supabase connections
- Sets `rejectUnauthorized: false` (Supabase uses self-signed certificates)

### 4. Environment-Specific Settings

```env
# Development
NODE_ENV=development
SUPABASE_SSL=true
synchronize=true  # Auto-create tables (dev only)

# Production
NODE_ENV=production
SUPABASE_SSL=true
synchronize=false  # Use migrations in production
```

### 5. Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use service role key** only on server-side (never expose to client)
3. **Rotate passwords** regularly
4. **Use connection pooling** to prevent connection exhaustion
5. **Enable SSL** always (required for Supabase)

## Database Schema

The system uses TypeORM entities that will be automatically created:

- `keywords` - Keyword research data
- `drafts` - Article drafts with status tracking
- `sections` - Individual article sections

### Running Migrations

In development, `synchronize: true` will auto-create tables.

For production, use TypeORM migrations:

```bash
# Generate migration
npm run typeorm migration:generate -- -n InitialSchema

# Run migrations
npm run typeorm migration:run
```

## Monitoring

Supabase provides built-in monitoring:

1. **Dashboard** → **Database** → **Connection Pooling**
   - Monitor active connections
   - Check connection pool usage

2. **Dashboard** → **Database** → **Logs**
   - View query logs
   - Monitor slow queries

## Troubleshooting

### Connection Timeout

If you see connection timeouts:

1. Check your IP is allowed in Supabase dashboard
2. Verify connection string format
3. Check SSL configuration
4. Increase `DB_CONNECTION_TIMEOUT`

### Too Many Connections

If you hit connection limits:

1. Reduce `DB_POOL_MAX`
2. Check for connection leaks
3. Use connection pooling properly

### SSL Errors

If you see SSL errors:

1. Ensure `SUPABASE_SSL=true`
2. Check certificate configuration
3. Verify connection string format

## Future Enhancements

With Supabase, you can easily add:

1. **Real-time subscriptions** for draft status updates
2. **Storage** for file uploads (images, exports)
3. **Authentication** for multi-user support
4. **Edge Functions** for serverless processing
5. **Row Level Security (RLS)** for data access control

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [TypeORM Documentation](https://typeorm.io/)
