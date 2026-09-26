import { sql } from "@/lib/db";
import { cityInput } from "@/lib/metadata";
import { coreRole, getCityBySlug, requireCoreTeam } from "@/lib/server/cities";
import { getMe } from "@/lib/server/session";
import { requireSession, handle, fail, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ slug: string }> };

/** The city, its core team, and the signed-in wallet's role in it (if any). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const city = await getCityBySlug((await ctx.params).slug);
  if (!city) fail(404, "City not found");
  const me = await getMe();
  const myRole = me ? await coreRole(city.id, me.address) : null;
  return Response.json({ city, myRole });
});

/**
 * Core team: edit the city's page. The slug never changes (residency metadata pins it), and the
 * dates can't shrink past a residency that is approved or deployed.
 */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const city = await getCityBySlug((await ctx.params).slug);
  if (!city) fail(404, "City not found");
  await requireCoreTeam(city.id, me.address);

  const parsed = cityInput.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(400, issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid form");
  }
  const v = parsed.data;

  const [outside] = await sql<{ n: string }[]>`
    SELECT count(*) AS n FROM residency_proposals
    WHERE city_id = ${city.id} AND status IN ('approved', 'deployed')
      AND (start_time < ${v.startTime} OR end_time > ${v.endTime})`;
  if (Number(outside.n) > 0) fail(400, "An approved residency falls outside those dates");

  await sql`
    UPDATE cities SET name = ${v.name}, location = ${v.location}, mission = ${v.mission},
           description = ${v.description}, start_time = ${v.startTime}, end_time = ${v.endTime}, updated_at = now()
    WHERE id = ${city.id}`;
  return Response.json({ city: await getCityBySlug(city.slug) });
});
