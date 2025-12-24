import { registerAs } from '@nestjs/config';

/**
 * Supabase configuration following best practices
 * 
 * Best Practices:
 * 1. Use direct connection URL for server-side (TypeORM)
 * 2. Use pooler URL for client connections (if needed)
 * 3. Always use SSL in production
 * 4. Configure connection pooling appropriately
 * 5. Use environment variables for all sensitive data
 */
export default registerAs('supabase', () => ({
  // Database connection URLs
  dbUrl: process.env.SUPABASE_DB_URL, // Pooler URL (for client connections)
  dbDirectUrl: process.env.SUPABASE_DB_DIRECT_URL, // Direct URL (for server connections - recommended)
  
  // Individual connection parameters (fallback)
  dbHost: process.env.DATABASE_HOST,
  dbPort: parseInt(process.env.DATABASE_PORT || '5432', 10),
  dbUser: process.env.DATABASE_USER,
  dbPassword: process.env.DATABASE_PASSWORD,
  dbName: process.env.DATABASE_NAME,
  
  // SSL configuration
  ssl: process.env.SUPABASE_SSL !== 'false', // Default to true for Supabase
  
  // Supabase API (optional - for future features like Storage, Auth, etc.)
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // Server-side only, never expose to client
  
  // Connection pool settings
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  },
}));

