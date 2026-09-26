import { sql } from "@/lib/db";
import { getResidency } from "@/lib/server/residencies";
import { requireSession, handle, fail, parseAddress } from "@/lib/server/http";

/** Host only: every application for this residency, with whether the applicant is a verified human. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const me = await requireSession();
  const address = parseAddress((await ctx.params).address);
  const residency = await getResidency(address);
  if (!residency) fail(404, "Residency not found");
  if (residency.host.toLowerCase() !== me.address.toLowerCase()) fail(403, "Only the host can review applications");

  const rows = await sql`
    SELECT a.id, a.applicant, a.name, a.bio, a.links, a.preferred_bed, a.status, a.bed_id, a.price_units,
           a.decision_tx, a.created_at, (u.verified_at IS NOT NULL) AS verified_human
    FROM applications a LEFT JOIN users u ON u.address = a.applicant
    WHERE a.residency = ${address.toLowerCase()}
    ORDER BY a.created_at ASC`;
  return Response.json({ applications: rows });
});
