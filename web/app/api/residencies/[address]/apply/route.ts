import { sql } from "@/lib/db";
import { applyInput, allBeds } from "@/lib/metadata";
import { getResidency } from "@/lib/server/residencies";
import { readResidencyState } from "@/lib/server/chain";
import { requireSession, requireVerified, handle, fail, parseAddress, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ address: string }> };

/** The signed-in wallet's own application for this residency, if any. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const residency = parseAddress((await ctx.params).address);
  const [row] = await sql`
    SELECT id, name, bio, links, preferred_bed, status, bed_id, price_units, decision_tx, created_at
    FROM applications WHERE residency = ${residency.toLowerCase()} AND applicant = ${me.address.toLowerCase()}`;
  return Response.json({ application: row ?? null });
});

/** Apply, or edit a pending/denied application. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireVerified();
  const address = parseAddress((await ctx.params).address);
  const residency = await getResidency(address);
  if (!residency) fail(404, "Residency not found");
  if (residency.host.toLowerCase() === me.address.toLowerCase()) fail(400, "Hosts don't apply to their own residency");

  const state = await readResidencyState(address);
  if (state.status !== "Open") fail(400, "This residency is no longer taking applications");

  const parsed = applyInput.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Invalid application");
  const v = parsed.data;
  if (v.preferredBedId !== null && !allBeds(residency.metadata).some((b) => b.id === v.preferredBedId))
    fail(400, "Unknown bed");

  const [row] = await sql`
    INSERT INTO applications (residency, applicant, name, bio, links, preferred_bed)
    VALUES (${address.toLowerCase()}, ${me.address.toLowerCase()}, ${v.name}, ${v.bio}, ${sql.json(v.links)}, ${v.preferredBedId})
    ON CONFLICT (residency, applicant) DO UPDATE
      SET name = EXCLUDED.name, bio = EXCLUDED.bio, links = EXCLUDED.links,
          preferred_bed = EXCLUDED.preferred_bed, status = 'pending', updated_at = now()
      WHERE applications.status <> 'approved'
    RETURNING id, status`;
  if (!row) fail(409, "You're already approved; your application can't be edited");
  return Response.json({ application: row });
});
