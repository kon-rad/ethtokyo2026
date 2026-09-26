import { getMe } from "@/lib/server/session";
import { getParticipation, getProfile } from "@/lib/server/profiles";
import { handle, fail, parseAddress } from "@/lib/server/http";

/** A public profile with the residencies and cities the person has been part of. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const address = parseAddress((await ctx.params).address);
  const profile = await getProfile(address);
  const me = await getMe();
  const isSelf = !!me && me.address.toLowerCase() === address.toLowerCase();
  // An unlisted profile is invisible to everyone but its owner.
  if (!profile || (!profile.listed && !isSelf)) fail(404, "Profile not found");
  return Response.json({ profile, participation: await getParticipation(address), isSelf });
});
