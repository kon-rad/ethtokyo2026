import { z } from "zod";
import { parseEventLogs, getAddress, isAddressEqual, type Hex } from "viem";
import { sql } from "@/lib/db";
import { factoryAbi } from "@/lib/abi";
import { config } from "@/lib/config";
import { metadataHash, launchInput, type CityMetadata } from "@/lib/metadata";
import { publicClient, readCityState } from "@/lib/server/chain";
import { toDto, type CityRow } from "@/lib/server/cities";
import { requireVerified, handle, fail, readJson } from "@/lib/server/http";

const PAGE = 12;

/** Live cities (not yet ended), newest first, with onchain status. `cursor` is an offset. */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);
  const now = Math.floor(Date.now() / 1000);
  const rows = await sql<CityRow[]>`
    SELECT * FROM cities WHERE end_time > ${now}
    ORDER BY created_at DESC, address LIMIT ${PAGE + 1} OFFSET ${offset}`;
  const page = rows.slice(0, PAGE);
  const cities = await Promise.all(
    page.map(async (r) => {
      const dto = toDto(r);
      const state = await readCityState(getAddress(dto.address)).catch(() => null);
      return { ...dto, state };
    }),
  );
  // "Live" = taking applications or running. Failed and closed cities drop out of the listing.
  const live = cities.filter((c) => !c.state || c.state.status === "Open" || c.state.status === "Active");
  return Response.json({ cities: live, nextCursor: rows.length > PAGE ? offset + PAGE : null });
});

const registerBody = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), metadataJson: z.string().max(200_000) });

/** Records a city after its createCity transaction is mined. Trusts only what the chain says. */
export const POST = handle(async (req: Request) => {
  const me = await requireVerified();
  const parsed = registerBody.safeParse(await readJson(req));
  if (!parsed.success) fail(400, "Invalid payload");
  const { txHash, metadataJson } = parsed.data;

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hex, timeout: 60_000 });
  if (receipt.status !== "success") fail(400, "Transaction failed");
  const [event] = parseEventLogs({ abi: factoryAbi, eventName: "CityCreated", logs: receipt.logs }).filter((l) =>
    isAddressEqual(l.address, config.factoryAddress),
  );
  if (!event) fail(400, "No CityCreated event from the AI City factory in this transaction");

  const a = event.args;
  if (!isAddressEqual(a.host, me.address)) fail(403, "This city was launched by a different wallet");
  if (metadataHash(metadataJson) !== a.metadataHash) fail(400, "Metadata doesn't match the onchain hash");

  const metadata = JSON.parse(metadataJson) as CityMetadata;
  const recheck = launchInput.safeParse({
    ...metadata,
    startTime: Number(a.startTime),
    endTime: Number(a.endTime),
    deadline: Math.max(Number(a.deadline), Math.floor(Date.now() / 1000) + 1),
    minSeats: a.minSeats,
    maxSeats: a.maxSeats,
  });
  if (!recheck.success) fail(400, "Metadata failed validation");

  const city = a.city.toLowerCase();
  await sql`
    INSERT INTO cities (address, host, metadata_json, metadata_hash, start_time, end_time, deadline,
                        min_seats, max_seats, created_tx, created_block)
    VALUES (${city}, ${a.host.toLowerCase()}, ${metadataJson}, ${a.metadataHash}, ${Number(a.startTime)},
            ${Number(a.endTime)}, ${Number(a.deadline)}, ${a.minSeats}, ${a.maxSeats}, ${txHash},
            ${receipt.blockNumber.toString()})
    ON CONFLICT (address) DO NOTHING`;
  return Response.json({ address: getAddress(city) });
});
