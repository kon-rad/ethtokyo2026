import "server-only";
import { sql } from "@/lib/db";
import { getCityBySlug } from "@/lib/server/cities";
import { getResidency } from "@/lib/server/residencies";
import { fail, parseAddress, requireSession } from "@/lib/server/http";
import type { Me } from "@/lib/server/session";
import { allBeds } from "@/lib/metadata";
import { argoNotes } from "@/lib/server/argo";

/** Platform-wide knowledge every concierge reads (scope 'shared'). */
const SHARED_KEYS = ["argo-journal"];

/** How much knowledge text goes into one concierge prompt. Beyond this, the best-matching chunks win. */
const CONTEXT_BUDGET_CHARS = 40_000;

type Source = { scope: "city" | "residency" | "shared"; key: string };

/**
 * A city's or residency's knowledge base: who may edit it, which bases its concierge reads
 * (a residency also reads its city's), and the listing facts that ground every answer.
 */
export type KnowledgeScope = {
  scope: "city" | "residency";
  key: string;
  name: string;
  editor: string; // lowercase address: the city's founder or the residency's host
  sources: Source[];
  facts: string;
};

export async function resolveScope(kind: "city" | "residency", raw: string): Promise<KnowledgeScope> {
  if (kind === "city") {
    const city = await getCityBySlug(raw);
    if (!city) fail(404, "City not found");
    return {
      scope: "city",
      key: city.slug,
      name: city.name,
      editor: city.founder.toLowerCase(),
      sources: [{ scope: "city", key: city.slug }, ...shared()],
      facts: [
        `# ${city.name} (pop-up city)`,
        `Location: ${city.location}`,
        `Dates: ${day(city.startTime)} to ${day(city.endTime)}`,
        `Core team: ${city.coreTeam.map((m) => `${m.name ?? m.address} (${m.role})`).join(", ")}`,
        `Mission: ${city.mission}`,
        `Description: ${city.description}`,
      ].join("\n"),
    };
  }

  const r = await getResidency(parseAddress(raw));
  if (!r || r.hidden) fail(404, "Residency not found");
  const m = r.metadata;
  const beds = allBeds(m).map((b) => `- Bed ${b.id}: ${b.label}, ${b.room} (${b.type}), ${b.price} USDC`);
  return {
    scope: "residency",
    key: r.address.toLowerCase(),
    name: m.name,
    editor: r.host.toLowerCase(),
    sources: [
      { scope: "residency", key: r.address.toLowerCase() },
      ...(r.city ? [{ scope: "city" as const, key: r.city.slug }] : []),
      ...shared(),
    ],
    facts: [
      `# ${m.name} (residency${r.city ? ` in ${r.city.name}` : ""})`,
      `Location: ${m.location}${m.propertyUrl ? ` (${m.propertyUrl})` : ""}`,
      `Dates: ${day(r.startTime)} to ${day(r.endTime)}. Application and payment deadline: ${day(r.deadline)}`,
      `Seats: needs ${r.minSeats} paid to go ahead, max ${r.maxSeats}. Prices are per bed for the whole stay, paid in USDC.`,
      `Beds:\n${beds.join("\n")}`,
      `Organizers: ${m.organizers.map((o) => o.name + (o.bio ? ` (${o.bio})` : "")).join("; ")}`,
      `Mission: ${m.mission}`,
      `Description: ${m.description}`,
    ].join("\n"),
  };
}

/** Only the city's founder, or the residency's host, edits its knowledge base. */
export async function requireEditor(s: KnowledgeScope): Promise<Me> {
  const me = await requireSession();
  if (me.address.toLowerCase() !== s.editor)
    fail(403, s.scope === "city" ? "Only the city's founder can edit its knowledge base" : "Only the host can edit this residency's knowledge base");
  return me;
}

export function canEdit(s: KnowledgeScope, me: Me | null): boolean {
  return !!me && me.address.toLowerCase() === s.editor;
}

// ------------------------------------------------------------------------------------ files

export type KnowledgeFileInfo = {
  filename: string;
  mime: string;
  chars: number;
  hasOriginal: boolean;
  updatedAt: string;
};

export async function listFiles(s: KnowledgeScope): Promise<KnowledgeFileInfo[]> {
  const rows = await sql<{ filename: string; mime: string; chars: number; has_original: boolean; updated_at: Date }[]>`
    SELECT filename, mime, length(content) AS chars, (source IS NOT NULL) AS has_original, updated_at
    FROM knowledge_files WHERE scope = ${s.scope} AND scope_key = ${s.key} ORDER BY filename`;
  return rows.map((r) => ({
    filename: r.filename,
    mime: r.mime,
    chars: Number(r.chars),
    hasOriginal: r.has_original,
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function readFile(s: KnowledgeScope, filename: string) {
  const [row] = await sql<{ filename: string; mime: string; content: string; has_original: boolean; updated_at: Date }[]>`
    SELECT filename, mime, content, (source IS NOT NULL) AS has_original, updated_at FROM knowledge_files
    WHERE scope = ${s.scope} AND scope_key = ${s.key} AND filename = ${filename}`;
  if (!row) return null;
  return {
    filename: row.filename,
    mime: row.mime,
    content: row.content,
    chars: row.content.length,
    hasOriginal: row.has_original,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function readOriginal(s: KnowledgeScope, filename: string) {
  const [row] = await sql<{ mime: string; source: Buffer | null }[]>`
    SELECT mime, source FROM knowledge_files WHERE scope = ${s.scope} AND scope_key = ${s.key} AND filename = ${filename}`;
  return row?.source ? { mime: row.mime, bytes: new Uint8Array(row.source) } : null;
}

export async function saveFile(
  s: KnowledgeScope,
  f: { filename: string; mime: string; content: string; source: Uint8Array | null },
  by: string,
): Promise<void> {
  await sql`
    INSERT INTO knowledge_files (scope, scope_key, filename, mime, content, source, updated_by)
    VALUES (${s.scope}, ${s.key}, ${f.filename}, ${f.mime}, ${f.content}, ${f.source ? Buffer.from(f.source) : null}, ${by.toLowerCase()})
    ON CONFLICT (scope, scope_key, filename) DO UPDATE
      SET mime = EXCLUDED.mime, content = EXCLUDED.content, source = EXCLUDED.source,
          updated_by = EXCLUDED.updated_by, updated_at = now()`;
}

export async function deleteFile(s: KnowledgeScope, filename: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM knowledge_files WHERE scope = ${s.scope} AND scope_key = ${s.key} AND filename = ${filename} RETURNING id`;
  return rows.length > 0;
}

// ----------------------------------------------------------------------------------- search

export type KnowledgeHit = {
  scope: Source["scope"];
  key: string;
  filename: string;
  chunk: number;
  snippet: string;
  text: string;
  rank: number;
};

/**
 * Full-text search over knowledge chunks. Words are OR-ed and ranked, so a natural-language
 * question still finds the chunks that share the most terms with it. Hidden residencies are skipped.
 */
export async function searchKnowledge(q: string, sources: Source[] | "all", limit: number): Promise<KnowledgeHit[]> {
  const keys = sources === "all" ? null : sources.map((s) => `${s.scope}:${s.key}`);
  const rows = await sql<(Omit<KnowledgeHit, "key" | "chunk" | "rank"> & { scope_key: string; idx: number; rank: number })[]>`
    WITH q AS (SELECT nullif(replace(plainto_tsquery('english', ${q})::text, ' & ', ' | '), '')::tsquery AS query)
    SELECT f.scope, f.scope_key, f.filename, c.idx, c.content AS text,
           ts_rank(c.search, q.query) AS rank,
           ts_headline('english', c.content, q.query,
                       'StartSel=**, StopSel=**, MaxFragments=2, MinWords=8, MaxWords=30, FragmentDelimiter=" … "') AS snippet
    FROM knowledge_chunks c JOIN knowledge_files f ON f.id = c.file_id, q
    WHERE q.query IS NOT NULL AND c.search @@ q.query
      ${keys ? sql`AND (f.scope || ':' || f.scope_key) = ANY(${keys})` : sql``}
      AND NOT EXISTS (SELECT 1 FROM residencies r WHERE f.scope = 'residency' AND r.address = f.scope_key AND r.hidden)
    ORDER BY rank DESC, f.filename, c.idx
    LIMIT ${limit}`;
  return rows.map((r) => ({
    scope: r.scope,
    key: r.scope_key,
    filename: r.filename,
    chunk: r.idx,
    snippet: r.snippet,
    text: r.text,
    rank: Number(r.rank),
  }));
}

/** A city's own knowledge plus that of every visible residency in it. */
export async function cityWideSources(slug: string): Promise<Source[]> {
  const rows = await sql<{ address: string }[]>`
    SELECT r.address FROM residencies r JOIN cities c ON c.id = r.city_id WHERE c.slug = ${slug} AND NOT r.hidden`;
  return [{ scope: "city", key: slug }, ...rows.map((r) => ({ scope: "residency" as const, key: r.address })), ...shared()];
}

// -------------------------------------------------------------------------------- concierge

/**
 * The concierge's system prompt: the listing facts, then knowledge from every source it reads.
 * Everything fits → whole files. Too much → the chunks that best match the question, in rank order.
 */
export async function buildConciergePrompt(s: KnowledgeScope, message: string): Promise<{ prompt: string; sources: string[] }> {
  const keys = s.sources.map((x) => `${x.scope}:${x.key}`);
  const [{ total }] = await sql<{ total: string | null }[]>`
    SELECT sum(length(content)) AS total FROM knowledge_files WHERE (scope || ':' || scope_key) = ANY(${keys})`;

  let blocks: { label: string; text: string }[];
  if (Number(total ?? 0) <= CONTEXT_BUDGET_CHARS) {
    const files = await sql<{ scope: string; filename: string; content: string }[]>`
      SELECT scope, filename, content FROM knowledge_files WHERE (scope || ':' || scope_key) = ANY(${keys})
      ORDER BY array_position(${keys}::text[], scope || ':' || scope_key), filename`;
    blocks = files.map((f) => ({ label: `${f.scope} · ${f.filename}`, text: f.content }));
  } else {
    const chunks = await sql<{ scope: string; filename: string; idx: number; content: string }[]>`
      WITH q AS (SELECT nullif(replace(plainto_tsquery('english', ${message})::text, ' & ', ' | '), '')::tsquery AS query)
      SELECT f.scope, f.filename, c.idx, c.content
      FROM knowledge_chunks c JOIN knowledge_files f ON f.id = c.file_id, q
      WHERE (f.scope || ':' || f.scope_key) = ANY(${keys})
      ORDER BY coalesce(ts_rank(c.search, q.query), 0) DESC,
               array_position(${keys}::text[], f.scope || ':' || f.scope_key), f.filename, c.idx
      LIMIT 200`;
    blocks = [];
    let used = 0;
    for (const c of chunks) {
      if (used + c.content.length > CONTEXT_BUDGET_CHARS) continue;
      used += c.content.length;
      blocks.push({ label: `${c.scope} · ${c.filename} (part ${c.idx + 1})`, text: c.content });
    }
  }

  const knowledge = blocks.map((b) => `--- ${b.label} ---\n${b.text}`).join("\n\n");
  const notes = await argoNotes(s);
  const kind = s.scope === "city" ? "pop-up city" : "residency";
  const prompt = `You are the AI concierge for ${s.name}, a ${kind} on AI City.

Your role: You are a warm, helpful guide. You connect people, answer questions about ${s.name}, and make sure everyone has what they need. Be concise (2-4 sentences). Use emojis sparingly. Answer only from the listing and knowledge below; if the answer isn't there, say so and suggest asking the organizers.${
    notes
      ? " When someone asks who they should meet, use the member notes to suggest specific introductions (a co-founder, business partner, opportunity, trade or topic to discuss) and say why each pair fits. Quote members only from their notes."
      : ""
  }

The listing:

${s.facts}

Knowledge base${s.scope === "residency" ? " (this residency's files, then its city's)" : ""}:

${knowledge || "(no files yet)"}
${
  notes
    ? `
Member notes (answers members approved from their Argo private journals, for matchmaking):

${notes}
`
    : ""
}
Current date: ${new Date().toISOString().split("T")[0]}`;

  const sources = [...new Set(blocks.map((b) => b.label.replace(/ \(part \d+\)$/, "")))];
  return { prompt, sources: notes ? [...sources, "argo · member notes"] : sources };
}

function shared(): Source[] {
  return SHARED_KEYS.map((key) => ({ scope: "shared", key }));
}

function day(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
