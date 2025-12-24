import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bullmq";
import { KeywordsModule } from "./keywords/keywords.module";
import { DraftsModule } from "./drafts/drafts.module";
import { WorkersModule } from "./workers/workers.module";
import { Draft } from "./drafts/entities/draft.entity";
import { Keyword } from "./keywords/entities/keyword.entity";
import { Section } from "./drafts/entities/section.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    // Supabase PostgreSQL connection with best practices
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Supabase connection string format:
        // postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
        const supabaseUrl = configService.get<string>("SUPABASE_DB_URL");
        const supabaseDirectUrl = configService.get<string>(
          "SUPABASE_DB_DIRECT_URL"
        );

        // Use direct connection URL for TypeORM (better for server-side)
        // Pooler URL is better for client connections, direct URL for server connections
        const connectionUrl = supabaseDirectUrl || supabaseUrl;

        // Parse connection string if provided, otherwise use individual params
        if (connectionUrl) {
          return {
            type: "postgres",
            url: connectionUrl,
            entities: [Draft, Keyword, Section],
            synchronize: configService.get<string>("NODE_ENV") !== "production",
            logging: configService.get<string>("NODE_ENV") === "development",
            ssl: configService.get<boolean>("SUPABASE_SSL", true)
              ? {
                  rejectUnauthorized: false, // Supabase uses self-signed certificates
                }
              : false,
            // Connection pooling settings (Supabase best practices)
            extra: {
              max: 20, // Maximum number of connections in the pool
              connectionTimeoutMillis: 5000,
              idleTimeoutMillis: 30000,
            },
          };
        }

        // Fallback to individual connection parameters
        return {
          type: "postgres",
          host: configService.get<string>("DATABASE_HOST", "localhost"),
          port: configService.get<number>("DATABASE_PORT", 5432),
          username: configService.get<string>("DATABASE_USER", "postgres"),
          password: configService.get<string>("DATABASE_PASSWORD", "postgres"),
          database: configService.get<string>("DATABASE_NAME", "postgres"),
          entities: [Draft, Keyword, Section],
          synchronize: configService.get<string>("NODE_ENV") !== "production",
          logging: configService.get<string>("NODE_ENV") === "development",
          ssl: configService.get<boolean>("SUPABASE_SSL", false)
            ? {
                rejectUnauthorized: false,
              }
            : false,
          extra: {
            max: 20,
            connectionTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 6379),
          password: configService.get<string>("REDIS_PASSWORD") || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    KeywordsModule,
    DraftsModule,
    WorkersModule,
  ],
})
export class AppModule {}
