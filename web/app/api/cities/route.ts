import { sql } from "@/lib/db";
import { cityInput, slugify } from "@/lib/metadata";
import { toCity, uniqueSlug, type CityRow } from "@/lib/server/cities";
import { requireVerified, handle, fail, readJson } from "@/lib/server/http";

const PAGE = 12;

/** Pop-up cities that haven't ended, soonest first, with how many residencies each has. */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);
  const now = Math.floor(Date.now() / 1000);
  const rows = await sql<(CityRow & { residency_count: string; team: { address: string; name: string | null }[] })[]>`
    SELECT c.*,
      (SELECT count(*) FROM residencies r WHERE r.city_id = c.id AND NOT r.hidden) AS residency_count,
      (SELECT coalesce(json_agg(json_build_object('address', t.address,
                                                  'name', CASE WHEN p.listed THEN p.name END)
                                ORDER BY (t.role = 'founder') DESC, t.added_at), '[]')
         FROM city_core_team t LEFT JOIN profiles p ON p.address = t.address
        WHERE t.city_id = c.id) AS team
    FROM cities c
    WHERE c.end_time > ${now}
    ORDER BY c.start_time ASC, c.id
    LIMIT ${PAGE + 1} OFFSET ${offset}`;
  const cities = rows.slice(0, PAGE).map((r) => ({
    ...toCity(r),
    residencyCount: Number(r.residency_count),
    coreTeam: r.team,
  }));
  return Response.json({ cities, nextCursor: rows.length > PAGE ? offset + PAGE : null });
});

/** Launch a pop-up city. The creator becomes its founder. No transaction: cities hold no money. */
export const POST = handle(async (req: Request) => {
  const me = await requireVerified();
  const parsed = cityInput.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(400, issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid form");
  }
  const v = parsed.data;
  const founder = me.address.toLowerCase();

  const slug = await sql.begin(async (tx) => {
    const slug = await uniqueSlug("cities", slugify(v.name));
    const [city] = await tx<{ id: string }[]>`
      INSERT INTO cities (slug, name, location, mission, description, start_time, end_time, founder)
      VALUES (${slug}, ${v.name}, ${v.location}, ${v.mission}, ${v.description}, ${v.startTime}, ${v.endTime}, ${founder})
      RETURNING id`;
    await tx`
      INSERT INTO city_core_team (city_id, address, role, added_by) VALUES (${city.id}, ${founder}, 'founder', ${founder})`;
    return slug;
  });
  return Response.json({ slug });
});
