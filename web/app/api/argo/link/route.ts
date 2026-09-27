import { z } from "zod";
import { getLink, normalizeHandle, removeLink, setLink } from "@/lib/server/argo";
import { fail, handle, readJson, requireSession, requireVerified } from "@/lib/server/http";

/** Your linked Argo journal, or null. */
export const GET = handle(async () => {
  const me = await requireSession();
  return Response.json({ link: await getLink(me.address) });
});

/** Link (or change) your Argo journal: { handle: "@username" | "0x…" }. Nothing is shared at link time. */
export const PUT = handle(async (req: Request) => {
  const me = await requireVerified();
  const parsed = z.object({ handle: z.string().min(1).max(64) }).safeParse(await readJson(req));
  if (!parsed.success) fail(400, "Expected { handle }");
  await setLink(me.address, normalizeHandle(parsed.data.handle));
  return Response.json({ link: await getLink(me.address) });
});

/** Unlink, and withdraw every answer you gave from the concierges. */
export const DELETE = handle(async () => {
  const me = await requireSession();
  await removeLink(me.address);
  return Response.json({ ok: true });
});
