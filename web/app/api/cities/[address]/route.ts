import { getCity } from "@/lib/server/cities";
import { handle, fail, parseAddress } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const city = await getCity(parseAddress((await ctx.params).address));
  if (!city) fail(404, "City not found");
  return Response.json({ city });
});
