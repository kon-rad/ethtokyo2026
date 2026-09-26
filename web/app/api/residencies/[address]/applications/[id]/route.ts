import { z } from "zod";
import { parseEventLogs, isAddressEqual, type Hex } from "viem";
import { sql } from "@/lib/db";
import { residencyAbi } from "@/lib/abi";
import { getResidency } from "@/lib/server/residencies";
import { publicClient } from "@/lib/server/chain";
import { requireSession, handle, fail, parseAddress, readJson } from "@/lib/server/http";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("deny") }),
  z.object({ action: z.literal("approved"), txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }),
  z.object({ action: z.literal("revoked"), txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }),
]);

type Ctx = { params: Promise<{ address: string; id: string }> };

/**
 * Host decisions. Deny is offchain only. Approve/revoke are recorded after the host's onchain
 * transaction is mined, from the event itself, so the database always matches the contract.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const { address: raw, id } = await ctx.params;
  const address = parseAddress(raw);
  const residency = await getResidency(address);
  if (!residency) fail(404, "Residency not found");
  if (residency.host.toLowerCase() !== me.address.toLowerCase()) fail(403, "Only the host can decide");

  const [app] = await sql<{ id: string; applicant: string; status: string }[]>`
    SELECT id, applicant, status FROM applications WHERE id = ${Number(id)} AND residency = ${address.toLowerCase()}`;
  if (!app) fail(404, "Application not found");

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, "Invalid decision");
  const d = parsed.data;

  if (d.action === "deny") {
    if (app.status === "approved") fail(400, "Revoke the onchain approval first");
    await sql`UPDATE applications SET status = 'denied', updated_at = now() WHERE id = ${app.id}`;
    return Response.json({ ok: true });
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: d.txHash as Hex, timeout: 60_000 });
  if (receipt.status !== "success") fail(400, "Transaction failed");
  const logs = receipt.logs.filter((l) => isAddressEqual(l.address, address));

  if (d.action === "approved") {
    const ev = parseEventLogs({ abi: residencyAbi, eventName: "Approved", logs }).find((l) =>
      isAddressEqual(l.args.member, app.applicant as Hex),
    );
    if (!ev) fail(400, "No matching Approved event in this transaction");
    await sql`
      UPDATE applications SET status = 'approved', bed_id = ${ev.args.bedId}, price_units = ${ev.args.price.toString()},
             decision_tx = ${d.txHash}, updated_at = now()
      WHERE id = ${app.id}`;
  } else {
    const ev = parseEventLogs({ abi: residencyAbi, eventName: "Revoked", logs }).find((l) =>
      isAddressEqual(l.args.member, app.applicant as Hex),
    );
    if (!ev) fail(400, "No matching Revoked event in this transaction");
    await sql`
      UPDATE applications SET status = 'pending', bed_id = NULL, price_units = NULL, decision_tx = ${d.txHash},
             updated_at = now()
      WHERE id = ${app.id}`;
  }
  return Response.json({ ok: true });
});
