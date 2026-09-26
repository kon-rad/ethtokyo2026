import { getAddress } from "viem";
import { sql } from "@/lib/db";
import { handle, fail } from "@/lib/server/http";

/** A residency series and its owner. Its instances come from GET /api/residencies?series=…&all=1. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const [s] = await sql<{ slug: string; name: string; description: string; owner: string; owner_name: string | null }[]>`
    SELECT s.slug, s.name, s.description, s.owner, CASE WHEN p.listed THEN p.name END AS owner_name
    FROM residency_series s LEFT JOIN profiles p ON p.address = s.owner
    WHERE s.slug = ${(await ctx.params).slug}`;
  if (!s) fail(404, "Residency series not found");
  return Response.json({ series: { ...s, owner: getAddress(s.owner) } });
});
