import { getResidency } from "@/lib/server/residencies";
import { handle, fail, parseAddress } from "@/lib/server/http";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const residency = await getResidency(parseAddress((await ctx.params).address));
  if (!residency) fail(404, "Residency not found");
  return Response.json({ residency });
});
