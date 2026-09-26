import { getResidency } from "@/lib/server/residencies";
import { issueChallenge } from "@/lib/server/door";
import { handle, fail, parseAddress } from "@/lib/server/http";

type Ctx = { params: Promise<{ address: string }> };

/** The door: a one-time challenge for the guest's Pi Zero to sign (valid 5 minutes). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const address = parseAddress((await ctx.params).address);
  if (!(await getResidency(address))) fail(404, "Residency not found");
  return Response.json({ challenge: issueChallenge(address) });
});
