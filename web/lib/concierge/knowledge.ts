import "server-only";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join } from "path";
import { sql } from "@/lib/db";

const KNOWLEDGE_ROOT = join(process.cwd(), "knowledge");

type KnowledgeFile = { filename: string; content: string };

/** Load all markdown files from a directory, recursively, returning filename + content. */
function loadDir(dir: string): KnowledgeFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      filename: f,
      content: readFileSync(join(dir, f), "utf-8"),
    }));
}

/** Load knowledge for a city: its folder + shared + argo journal. */
export function loadCityKnowledge(slug: string): KnowledgeFile[] {
  const cityDir = join(KNOWLEDGE_ROOT, "cities", slug);
  const sharedDir = join(KNOWLEDGE_ROOT, "shared");
  return [...loadDir(cityDir), ...loadDir(join(sharedDir, "argo-journal"))];
}

/** Load knowledge for a residency: its folder + parent city + shared + argo journal. */
export function loadResidencyKnowledge(address: string): KnowledgeFile[] {
  const residencyDir = join(KNOWLEDGE_ROOT, "residencies", address);
  const sharedDir = join(KNOWLEDGE_ROOT, "shared");
  return [
    ...loadDir(residencyDir),
    ...loadDir(join(sharedDir, "argo-journal")),
  ];
}

export type { KnowledgeFile };

/** Build a system prompt from knowledge files. */
export function buildConciergePrompt(scope: string, scopeName: string, knowledge: KnowledgeFile[]): string {
  const fileList = knowledge.map((f) => `--- ${f.filename} ---\n${f.content}`).join("\n\n");
  return `You are the AI concierge for ${scope} on AI City.

Your role: You are a warm, helpful guide. You connect people, answer questions about the ${scope}, and make sure everyone has what they need. Be concise (2-4 sentences). Use emojis sparingly. If you don't know something, say so.

Your knowledge about ${scopeName}:

${fileList}

Current date: ${new Date().toISOString().split("T")[0]}`;
}

/** List knowledge files for a city. */
export function listCityKnowledge(slug: string): string[] {
  const dir = join(KNOWLEDGE_ROOT, "cities", slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

/** Read a specific knowledge file for a city. */
export function getCityKnowledgeFile(slug: string, filename: string): string | null {
  const path = join(KNOWLEDGE_ROOT, "cities", slug, filename);
  if (!existsSync(path) || !filename.endsWith(".md")) return null;
  return readFileSync(path, "utf-8");
}

/** List knowledge files for a residency. */
export function listResidencyKnowledge(address: string): string[] {
  const dir = join(KNOWLEDGE_ROOT, "residencies", address);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

/** Read a specific knowledge file for a residency. */
export function getResidencyKnowledgeFile(address: string, filename: string): string | null {
  const path = join(KNOWLEDGE_ROOT, "residencies", address, filename);
  if (!existsSync(path) || !filename.endsWith(".md")) return null;
  return readFileSync(path, "utf-8");
}