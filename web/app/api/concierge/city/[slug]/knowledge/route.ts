import { listCityKnowledge, getCityKnowledgeFile } from "@/lib/concierge/knowledge";
import { handle, fail } from "@/lib/server/http";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { readJson } from "@/lib/server/http";

const KNOWLEDGE_ROOT = join(process.cwd(), "knowledge");

type Ctx = { params: Promise<{ slug: string }> };
type FileCtx = { params: Promise<{ slug: string; file: string }> };

/** List all knowledge files for a city. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const files = listCityKnowledge(slug);
  return Response.json({ files });
});

/** Upsert a knowledge file (body: { filename, content }). */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const { filename, content } = (await readJson(req)) as {
    filename?: string;
    content?: string;
  };
  if (!filename || !filename.endsWith(".md")) fail(400, "filename must end in .md");
  if (!content) fail(400, "content is required");

  const dir = join(KNOWLEDGE_ROOT, "cities", slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf-8");
  return Response.json({ ok: true, filename });
});

/** Delete a knowledge file. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { slug, file } = (await ctx.params) as { slug: string; file: string };
  // Actually DELETE comes in with slug and file via URL search or body, let's use a query approach
  // The route will be DELETE /api/concierge/city/:slug/knowledge with body { filename }
  const { filename } = (await readJson(req)) as { filename?: string };
  if (!filename) fail(400, "filename is required");

  const path = join(KNOWLEDGE_ROOT, "cities", slug, filename);
  if (!existsSync(path)) fail(404, "File not found");
  unlinkSync(path);
  return Response.json({ ok: true });
});