// Loads the markdown seed files in knowledge/ into Postgres, where the app reads them.
//   knowledge/cities/<slug>/*.md          → that city's knowledge base
//   knowledge/residencies/<address>/*.md  → that residency's
//   knowledge/shared/argo-journal/*.md    → read by every concierge
// Existing files with the same name are replaced; nothing is deleted.
//   DATABASE_URL=… node scripts/import-knowledge.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { max: 1 });
const root = new URL("../knowledge/", import.meta.url);

const scopes = [
  ["city", "cities"],
  ["residency", "residencies"],
  ["shared", "shared"],
];
let n = 0;
for (const [scope, dir] of scopes) {
  const base = new URL(`${dir}/`, root);
  if (!existsSync(base)) continue;
  for (const key of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    if (scope === "shared" && key !== "argo-journal") continue; // templates are for people, not concierges
    const scopeKey = scope === "residency" ? key.toLowerCase() : key;
    for (const filename of readdirSync(new URL(`${key}/`, base)).filter((f) => f.endsWith(".md"))) {
      const content = readFileSync(new URL(`${key}/${filename}`, base), "utf8").replace(/\r\n?/g, "\n");
      await sql`
        INSERT INTO knowledge_files (scope, scope_key, filename, mime, content)
        VALUES (${scope}, ${scopeKey}, ${filename}, 'text/markdown', ${content})
        ON CONFLICT (scope, scope_key, filename) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`;
      console.log(`${scope}/${scopeKey}/${filename}`);
      n++;
    }
  }
}
await sql.end();
console.log(`${n} files imported`);
