import "server-only";
import { z } from "zod";
import { getMe } from "@/lib/server/session";
import { handle, fail, readJson } from "@/lib/server/http";
import { canEdit, deleteFile, listFiles, readFile, readOriginal, requireEditor, resolveScope, saveFile } from "./knowledge";
import { MAX_TEXT_CHARS, MAX_UPLOAD_BYTES, TEXT_MIMES, checkFilename, extractText } from "./extract";

type Ctx = { params: Promise<Record<string, string>> };

const textBody = z.object({ filename: z.string(), content: z.string().min(1, "content is required").max(MAX_TEXT_CHARS) });
const deleteBody = z.object({ filename: z.string().min(1, "filename is required") });

/**
 * The knowledge-base API for one kind of scope, mounted at
 * /api/concierge/city/[slug]/knowledge and /api/concierge/residency/[address]/knowledge.
 * Reading is public; writing is the city's founder or the residency's host.
 */
export function knowledgeHandlers(kind: "city" | "residency") {
  const scopeOf = async (ctx: Ctx) => resolveScope(kind, (await ctx.params)[kind === "city" ? "slug" : "address"]);

  /** No query: the file list. `?file=`: one file's text. `?file=&original=1`: the uploaded original. */
  const GET = handle(async (req: Request, ctx: Ctx) => {
    const s = await scopeOf(ctx);
    const url = new URL(req.url);
    const filename = url.searchParams.get("file");

    if (!filename) {
      const me = await getMe();
      return Response.json({ scope: { kind, key: s.key, name: s.name }, canEdit: canEdit(s, me), files: await listFiles(s) });
    }
    if (url.searchParams.get("original") === "1") {
      const original = await readOriginal(s, filename);
      if (!original) fail(404, "No original for that file");
      return new Response(original.bytes, {
        headers: {
          "content-type": original.mime,
          "content-disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
          "x-content-type-options": "nosniff",
        },
      });
    }
    const file = await readFile(s, filename);
    if (!file) fail(404, "File not found");
    return Response.json({ file });
  });

  /** Create or replace a text file: { filename, content }. */
  const PUT = handle(async (req: Request, ctx: Ctx) => {
    const s = await scopeOf(ctx);
    const me = await requireEditor(s);
    const parsed = textBody.safeParse(await readJson(req));
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Expected { filename, content }");
    const { filename, mime } = checkFilename(parsed.data.filename);
    if (!TEXT_MIMES.has(mime)) fail(400, "Upload PDFs and Word files as files (POST multipart), not as text");
    await saveFile(s, { filename, mime, content: parsed.data.content.replace(/\r\n?/g, "\n"), source: null }, me.address);
    return Response.json({ ok: true, filename });
  });

  /** Upload a file (multipart `file`, optional `filename`). Its text is extracted and indexed. */
  const POST = handle(async (req: Request, ctx: Ctx) => {
    const s = await scopeOf(ctx);
    const me = await requireEditor(s);
    const form = await req.formData().catch(() => fail(400, "Expected a multipart form with a file"));
    const file = form.get("file");
    if (!(file instanceof File)) fail(400, "Attach the file");
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) fail(400, "Files must be under 4 MB");

    const { filename, mime } = checkFilename(String(form.get("filename") || file.name));
    const bytes = new Uint8Array(await file.arrayBuffer());
    const content = await extractText(bytes, mime);
    await saveFile(s, { filename, mime, content, source: TEXT_MIMES.has(mime) ? null : bytes }, me.address);
    return Response.json({ ok: true, filename, chars: content.length });
  });

  /** Delete a file: { filename }. */
  const DELETE = handle(async (req: Request, ctx: Ctx) => {
    const s = await scopeOf(ctx);
    await requireEditor(s);
    const parsed = deleteBody.safeParse(await readJson(req));
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "filename is required");
    if (!(await deleteFile(s, parsed.data.filename))) fail(404, "File not found");
    return Response.json({ ok: true });
  });

  return { GET, PUT, POST, DELETE };
}
