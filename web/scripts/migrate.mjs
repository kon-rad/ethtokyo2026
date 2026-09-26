// Applies db/schema.sql to DATABASE_URL.
import { readFileSync } from "node:fs";
import postgres from "postgres";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { max: 1 });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await sql.end();
console.log("schema applied");
