import { sql } from "@/lib/db";
import { residencyInput, buildMetadata, canonicalJson, metadataHash, slugify } from "@/lib/metadata";
import { getCityBySlug, requireCoreTeam, uniqueSlug } from "@/lib/server/cities";
import { listProposals } from "@/lib/server/proposals";
import { requireSession, requireVerified, handle, fail, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ slug: string }> };

/** Core team: every proposal for this city, newest first. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const city = await getCityBySlug((await ctx.params).slug);
  if (!city) fail(404, "City not found");
  await requireCoreTeam(city.id, me.address);
  return Response.json({ proposals: await listProposals({ cityId: city.id }) });
});

/**
 * Propose a residency inside this city. Its dates must fall within the city's. The residency is
 * either the first instance of a new series or the next instance of a series the proposer owns.
 * The canonical metadata (pinning city, series and proposal id) is fixed here, at proposal time,
 * so what the core team approves is exactly what gets deployed.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireVerified();
  const city = await getCityBySlug((await ctx.params).slug);
  if (!city) fail(404, "City not found");

  const parsed = residencyInput.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(400, issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid form");
  }
  const v = parsed.data;
  if (v.startTime < city.startTime || v.endTime > city.endTime)
    fail(400, "The residency's dates must fall within the city's dates");

  const proposer = me.address.toLowerCase();
  const proposal = await sql.begin(async (tx) => {
    let series: { id: string; slug: string };
    if ("seriesSlug" in v.series) {
      const [s] = await tx<{ id: string; slug: string; owner: string }[]>`
        SELECT id, slug, owner FROM residency_series WHERE slug = ${v.series.seriesSlug}`;
      if (!s) fail(404, "Residency series not found");
      if (s.owner !== proposer) fail(403, "Only the series owner can propose its next instance");
      series = s;
    } else {
      const slug = await uniqueSlug("residency_series", slugify(v.series.newSeries.name));
      [series] = await tx<{ id: string; slug: string }[]>`
        INSERT INTO residency_series (slug, name, description, owner)
        VALUES (${slug}, ${v.series.newSeries.name}, ${v.series.newSeries.description}, ${proposer})
        RETURNING id, slug`;
    }

    const [row] = await tx<{ id: string }[]>`
      INSERT INTO residency_proposals (city_id, series_id, proposer, metadata_json, metadata_hash,
                                       start_time, end_time, deadline, min_seats, max_seats)
      VALUES (${city.id}, ${series.id}, ${proposer}, '', '', ${v.startTime}, ${v.endTime}, ${v.deadline},
              ${v.minSeats}, ${v.maxSeats})
      RETURNING id`;
    const json = canonicalJson(buildMetadata(v, { cityId: city.slug, seriesId: series.slug, proposalId: Number(row.id) }));
    await tx`
      UPDATE residency_proposals SET metadata_json = ${json}, metadata_hash = ${metadataHash(json)} WHERE id = ${row.id}`;
    return { id: Number(row.id), seriesSlug: series.slug };
  });
  return Response.json({ proposal });
});
