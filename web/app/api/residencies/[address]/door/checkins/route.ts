import { z } from "zod";
import type { Hex } from "viem";
import { getResidency } from "@/lib/server/residencies";
import { getPresence, recordCheckin } from "@/lib/server/door";
import { handle, fail, parseAddress, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ address: string }> };

const body = z.object({
  challenge: z.string(),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Expected a 65-byte signature"),
});

/** Public, for the board: who is inside now and the latest door events. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const residency = await getResidency(parseAddress((await ctx.params).address));
  if (!residency) fail(404, "Residency not found");
  return Response.json(await getPresence(residency));
});

/** The door, after it opened: the guest's signature over a challenge from ./challenge. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const address = parseAddress((await ctx.params).address);
  if (!(await getResidency(address))) fail(404, "Residency not found");
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0].message);
  const checkin = await recordCheckin(address, parsed.data.challenge, parsed.data.signature as Hex);
  return Response.json({ checkin });
});
