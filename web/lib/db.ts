import "server-only";
import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

/** One pooled client per server instance (reused across hot reloads in dev). */
export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL ?? "postgres://localhost/ai_city", {
    max: 5,
    idle_timeout: 20,
    ssl: process.env.DATABASE_URL?.includes("sslmode=require") ? "require" : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
