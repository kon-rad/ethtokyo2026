import { z } from "zod";
import { sql } from "@/lib/db";
import { requireCoreTeam } from "@/lib/server/cities";
import { getResidency } from "@/lib/server/residencies";
import { requireSession, handle, fail, parseAddress, readJson } from "@/lib/server/http";

const body = z.object({ hidden: z.boolean(), note: z.string().trim().max(500).default("") });

/**
 * The city's core team can hide a residency from the city and the listings, with a public note.
 * Hiding never touches the contract: members can still claim refunds or leftovers onchain.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const me = await requireSession();
  const address = parseAddress((await ctx.params).address);
  const residency = await getResidency(address);
  if (!residency) fail(404, "Residency not found");
  if (!residency.city) fail(400, "This residency isn't part of a city");
  await requireCoreTeam(residency.city.id, me.address);

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, "Invalid request");
  const { hidden, note } = parsed.data;
  if (hidden && !note) fail(400, "Say why, in a public note");

  await sql`
    UPDATE residencies SET hidden = ${hidden}, hidden_note = ${hidden ? note : null}
    WHERE address = ${address.toLowerCase()}`;
  return Response.json({ ok: true });
});
