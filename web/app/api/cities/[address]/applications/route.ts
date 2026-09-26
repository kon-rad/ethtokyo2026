import { sql } from "@/lib/db";
import { getCity } from "@/lib/server/cities";
import { requireSession, handle, fail, parseAddress } from "@/lib/server/http";

/** Host only: every application for this city, with whether the applicant is a verified human. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const me = await requireSession();
  const address = parseAddress((await ctx.params).address);
  const city = await getCity(address);
  if (!city) fail(404, "City not found");
  if (city.host.toLowerCase() !== me.address.toLowerCase()) fail(403, "Only the host can review applications");

  const rows = await sql`
    SELECT a.id, a.applicant, a.name, a.bio, a.links, a.preferred_bed, a.status, a.bed_id, a.price_units,
           a.decision_tx, a.created_at, (u.verified_at IS NOT NULL) AS verified_human
    FROM applications a LEFT JOIN users u ON u.address = a.applicant
    WHERE a.city = ${address.toLowerCase()}
    ORDER BY a.created_at ASC`;
  return Response.json({ applications: rows });
});
