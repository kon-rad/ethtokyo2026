import { parseEventLogs, isAddressEqual, sha256, toHex, type Hex } from "viem";
import { sql } from "@/lib/db";
import { cityAbi } from "@/lib/abi";
import { getCity } from "@/lib/server/cities";
import { publicClient, isStaker } from "@/lib/server/chain";
import { requireSession, handle, fail, parseAddress } from "@/lib/server/http";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
type Ctx = { params: Promise<{ address: string }> };

/** Host or staked members: list receipt files (without their bytes). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const address = parseAddress((await ctx.params).address);
  const city = await getCity(address);
  if (!city) fail(404, "City not found");
  const isHost = city.host.toLowerCase() === me.address.toLowerCase();
  if (!isHost && !(await isStaker(address, me.address))) fail(403, "Only members can see receipts");

  const rows = await sql`
    SELECT id, tx_hash, receipt_hash, filename, mime, created_at FROM receipts
    WHERE city = ${address.toLowerCase()} ORDER BY created_at DESC`;
  return Response.json({ receipts: rows });
});

/** Host: upload the receipt file for a mined withdraw(). Its sha256 must match the onchain hash. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const address = parseAddress((await ctx.params).address);
  const city = await getCity(address);
  if (!city) fail(404, "City not found");
  if (city.host.toLowerCase() !== me.address.toLowerCase()) fail(403, "Only the host uploads receipts");

  const form = await req.formData();
  const file = form.get("file");
  const txHash = String(form.get("txHash") ?? "");
  if (!(file instanceof File)) fail(400, "Attach the receipt file");
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) fail(400, "Invalid transaction hash");
  if (file.size === 0 || file.size > MAX_BYTES) fail(400, "Receipts must be under 4 MB");
  if (!ALLOWED_TYPES.has(file.type)) fail(400, "Receipts must be a PDF, PNG, JPEG or WebP");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = sha256(toHex(bytes));

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hex, timeout: 60_000 });
  const ev = parseEventLogs({
    abi: cityAbi,
    eventName: "Withdrawn",
    logs: receipt.logs.filter((l) => isAddressEqual(l.address, address)),
  })[0];
  if (!ev) fail(400, "No withdrawal from this city in that transaction");
  if (ev.args.receiptHash.toLowerCase() !== hash.toLowerCase()) fail(400, "File doesn't match the receipt hash onchain");

  await sql`
    INSERT INTO receipts (city, tx_hash, receipt_hash, filename, mime, data)
    VALUES (${address.toLowerCase()}, ${txHash}, ${hash}, ${file.name.slice(0, 200)},
            ${file.type}, ${Buffer.from(bytes)})
    ON CONFLICT (tx_hash) DO NOTHING`;
  return Response.json({ ok: true });
});
