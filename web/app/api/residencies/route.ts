import { z } from "zod";
import { parseEventLogs, getAddress, isAddressEqual, type Hex } from "viem";
import { sql } from "@/lib/db";
import { factoryAbi } from "@/lib/abi";
import { config } from "@/lib/config";
import { publicClient, readResidencyState } from "@/lib/server/chain";
import { residencySelect, toDto, type ResidencyRow } from "@/lib/server/residencies";
import { requireVerified, handle, fail, readJson } from "@/lib/server/http";

const PAGE = 12;

/**
 * Residencies with onchain status. By default: visible, not yet ended, taking applications or
 * running, with open ones first (soonest deadline first). `city` or `series` narrows the list;
 * `all=1` also includes past, failed and closed residencies (for city and series pages).
 */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);
  const city = url.searchParams.get("city");
  const series = url.searchParams.get("series");
  const all = url.searchParams.get("all") === "1";
  const now = Math.floor(Date.now() / 1000);

  const rows = await sql<ResidencyRow[]>`
    ${residencySelect(sql)}
    WHERE NOT r.hidden AND r.city_id IS NOT NULL
      ${all ? sql`` : sql`AND r.end_time > ${now}`}
      ${city ? sql`AND c.slug = ${city}` : sql``}
      ${series ? sql`AND rs.slug = ${series}` : sql``}
    ORDER BY (r.deadline > ${now}) DESC,
             CASE WHEN r.deadline > ${now} THEN r.deadline ELSE -r.start_time END ASC,
             r.address
    LIMIT ${PAGE + 1} OFFSET ${offset}`;
  const page = rows.slice(0, PAGE);
  const residencies = await Promise.all(
    page.map(async (r) => {
      const dto = toDto(r);
      const state = await readResidencyState(getAddress(dto.address)).catch(() => null);
      return { ...dto, state };
    }),
  );
  // Default listing: "live" = taking applications or running. Failed and closed drop out.
  const shown = all
    ? residencies
    : residencies.filter((r) => !r.state || r.state.status === "Open" || r.state.status === "Active");
  return Response.json({ residencies: shown, nextCursor: rows.length > PAGE ? offset + PAGE : null });
});

const deployBody = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  proposalId: z.number().int().positive(),
});

type ProposalRow = {
  id: string;
  city_id: string;
  series_id: string;
  proposer: string;
  metadata_json: string;
  metadata_hash: string;
  start_time: string;
  end_time: string;
  deadline: string;
  min_seats: number;
  max_seats: number;
  status: string;
};

/**
 * Records a residency after the proposer deploys it. The transaction must come from the factory,
 * be sent by the proposer, and match the approved proposal exactly: metadata hash, dates and seats.
 */
export const POST = handle(async (req: Request) => {
  const me = await requireVerified();
  const parsed = deployBody.safeParse(await readJson(req));
  if (!parsed.success) fail(400, "Invalid payload");
  const { txHash, proposalId } = parsed.data;

  const [p] = await sql<ProposalRow[]>`SELECT * FROM residency_proposals WHERE id = ${proposalId}`;
  if (!p) fail(404, "Proposal not found");
  if (p.proposer !== me.address.toLowerCase()) fail(403, "Only the proposer deploys this residency");
  if (p.status === "deployed") fail(409, "This proposal is already deployed");
  if (p.status !== "approved") fail(400, "The city's core team hasn't approved this proposal");

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hex, timeout: 60_000 });
  if (receipt.status !== "success") fail(400, "Transaction failed");
  const [event] = parseEventLogs({ abi: factoryAbi, eventName: "ResidencyCreated", logs: receipt.logs }).filter((l) =>
    isAddressEqual(l.address, config.factoryAddress),
  );
  if (!event) fail(400, "No ResidencyCreated event from the AI City factory in this transaction");

  const a = event.args;
  if (!isAddressEqual(a.host, me.address)) fail(403, "This residency was deployed by a different wallet");
  if (a.metadataHash.toLowerCase() !== p.metadata_hash.toLowerCase())
    fail(400, "The deployed metadata doesn't match the approved proposal");
  const same =
    Number(a.startTime) === Number(p.start_time) &&
    Number(a.endTime) === Number(p.end_time) &&
    Number(a.deadline) === Number(p.deadline) &&
    a.minSeats === p.min_seats &&
    a.maxSeats === p.max_seats;
  if (!same) fail(400, "The deployed dates or seats don't match the approved proposal");

  const residency = a.residency.toLowerCase();
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO residencies (address, host, metadata_json, metadata_hash, start_time, end_time, deadline,
                               min_seats, max_seats, created_tx, created_block, city_id, series_id, proposal_id)
      VALUES (${residency}, ${a.host.toLowerCase()}, ${p.metadata_json}, ${p.metadata_hash}, ${Number(a.startTime)},
              ${Number(a.endTime)}, ${Number(a.deadline)}, ${a.minSeats}, ${a.maxSeats}, ${txHash},
              ${receipt.blockNumber.toString()}, ${p.city_id}, ${p.series_id}, ${p.id})`;
    await tx`UPDATE residency_proposals SET status = 'deployed' WHERE id = ${p.id}`;
  });
  return Response.json({ address: getAddress(residency) });
});
