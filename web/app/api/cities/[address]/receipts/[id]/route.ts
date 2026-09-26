import { sql } from "@/lib/db";
import { getCity } from "@/lib/server/cities";
import { isStaker } from "@/lib/server/chain";
import { requireSession, handle, fail, parseAddress } from "@/lib/server/http";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);

/** Download one receipt file. Host or staked members only. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ address: string; id: string }> }) => {
  const me = await requireSession();
  const { address: raw, id } = await ctx.params;
  const address = parseAddress(raw);
  const city = await getCity(address);
  if (!city) fail(404, "City not found");
  const isHost = city.host.toLowerCase() === me.address.toLowerCase();
  if (!isHost && !(await isStaker(address, me.address))) fail(403, "Only members can see receipts");

  const [row] = await sql<{ filename: string; mime: string; data: Buffer }[]>`
    SELECT filename, mime, data FROM receipts WHERE id = ${Number(id)} AND city = ${address.toLowerCase()}`;
  if (!row) fail(404, "Receipt not found");
  return new Response(new Uint8Array(row.data), {
    headers: {
      "content-type": ALLOWED.has(row.mime) ? row.mime : "application/octet-stream",
      "content-disposition": `inline; filename="${row.filename.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
});
