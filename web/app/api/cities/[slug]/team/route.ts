import { z } from "zod";
import { isAddress } from "viem";
import { sql } from "@/lib/db";
import { coreTeam, getCityBySlug, requireCoreTeam } from "@/lib/server/cities";
import { requireSession, handle, fail, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ slug: string }> };
const body = z.object({ address: z.string().refine((v) => isAddress(v), "Invalid address") });

/** Any core team member can add someone to the core team. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const city = await getCityBySlug((await ctx.params).slug);
  if (!city) fail(404, "City not found");
  await requireCoreTeam(city.id, me.address);

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Invalid address");
  const address = parsed.data.address.toLowerCase();

  await sql`
    INSERT INTO city_core_team (city_id, address, role, added_by)
    VALUES (${city.id}, ${address}, 'core', ${me.address.toLowerCase()})
    ON CONFLICT (city_id, address) DO NOTHING`;
  return Response.json({ coreTeam: await coreTeam(city.id) });
});

/** Only the founder removes core team members, and the founder can't be removed. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const me = await requireSession();
  const city = await getCityBySlug((await ctx.params).slug);
  if (!city) fail(404, "City not found");
  const role = await requireCoreTeam(city.id, me.address);
  if (role !== "founder") fail(403, "Only the founder can remove core team members");

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Invalid address");
  const address = parsed.data.address.toLowerCase();
  if (address === city.founder) fail(400, "The founder can't be removed");

  await sql`DELETE FROM city_core_team WHERE city_id = ${city.id} AND address = ${address} AND role = 'core'`;
  return Response.json({ coreTeam: await coreTeam(city.id) });
});
