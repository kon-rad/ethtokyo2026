import { sql } from "@/lib/db";
import { getMe } from "@/lib/server/session";
import { handle, fail, parseAddress } from "@/lib/server/http";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/** A profile photo. Served only for listed profiles (or to their owner). */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const address = parseAddress((await ctx.params).address).toLowerCase();
  const [row] = await sql<{ photo: Buffer | null; photo_mime: string | null; listed: boolean }[]>`
    SELECT photo, photo_mime, listed FROM profiles WHERE address = ${address}`;
  const me = await getMe();
  const isSelf = me?.address.toLowerCase() === address;
  if (!row?.photo || !row.photo_mime || (!row.listed && !isSelf)) fail(404, "No photo");
  return new Response(new Uint8Array(row.photo), {
    headers: {
      "content-type": ALLOWED.has(row.photo_mime) ? row.photo_mime : "application/octet-stream",
      "cache-control": row.listed ? "public, max-age=300" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
