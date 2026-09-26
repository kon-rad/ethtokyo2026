import { cityWideSources, resolveScope, searchKnowledge } from "@/lib/concierge/knowledge";
import { handle, fail } from "@/lib/server/http";

/**
 * Search knowledge bases. `residency=` searches it and its city; `city=` searches the city and all
 * its residencies; neither searches everything public. Returns matching chunks, best first.
 */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().slice(0, 200);
  if (!q) fail(400, "q is required");
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit") ?? 10) || 10));
  const residency = url.searchParams.get("residency");
  const city = url.searchParams.get("city");

  let sources: Awaited<ReturnType<typeof cityWideSources>> | "all" = "all";
  if (residency) sources = (await resolveScope("residency", residency)).sources;
  else if (city) sources = await cityWideSources((await resolveScope("city", city)).key);
  return Response.json({ hits: await searchKnowledge(q, sources, limit) });
});
