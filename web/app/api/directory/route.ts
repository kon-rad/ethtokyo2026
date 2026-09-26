import { listDirectory } from "@/lib/server/profiles";
import { handle } from "@/lib/server/http";

const PAGE = 24;

/** Public directory of listed profiles. `q` searches name and bio; `city` narrows to one city's people. */
export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);
  const { profiles, more } = await listDirectory({
    q: url.searchParams.get("q")?.slice(0, 80) ?? undefined,
    citySlug: url.searchParams.get("city") ?? undefined,
    limit: PAGE,
    offset,
  });
  return Response.json({ profiles, nextCursor: more ? offset + PAGE : null });
});
