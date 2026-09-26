import { listResidencyKnowledge, getResidencyKnowledgeFile } from "@/lib/concierge/knowledge";
import { handle, fail } from "@/lib/server/http";
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { readJson } from "@/lib/server/http";

const KNOWLEDGE_ROOT = join(process.cwd(), "knowledge");

type Ctx = { params: Promise<{ address: string }> };

/** List all knowledge files for a residency. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { address } = await ctx.params;
  const files = listResidencyKnowledge(address);
  return Response.json({ files });
});

/** Upsert a knowledge file (body: { filename, content }). */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const { address } = await ctx.params;
  const { filename, content } = (await readJson(req)) as {
    filename?: string;
    content?: string;
  };
  if (!filename || !filename.endsWith(".md")) fail(400, "filename must end in .md");
  if (!content) fail(400, "content is required");

  const dir = join(KNOWLEDGE_ROOT, "residencies", address);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf-8");
  return Response.json({ ok: true, filename });
});

/** Delete a knowledge file. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const { address } = await ctx.params;
  const { filename } = (await readJson(req)) as { filename?: string };
  if (!filename) fail(400, "filename is required");

  const path = join(KNOWLEDGE_ROOT, "residencies", address, filename);
  if (!existsSync(path)) fail(404, "File not found");
  unlinkSync(path);
  return Response.json({ ok: true });
});