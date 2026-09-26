import { sql } from "@/lib/db";
import { requireSession, handle } from "@/lib/server/http";

/** Series the signed-in wallet owns, for "propose the next instance". */
export const GET = handle(async () => {
  const me = await requireSession();
  const series = await sql<{ slug: string; name: string; description: string }[]>`
    SELECT slug, name, description FROM residency_series WHERE owner = ${me.address.toLowerCase()} ORDER BY created_at DESC`;
  return Response.json({ series });
});
