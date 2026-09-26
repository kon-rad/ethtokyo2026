import { revokeApiKey } from "@/lib/server/api-keys";
import { requireCookieSession, handle, fail } from "@/lib/server/http";

/** Revoke one of your keys. Requests using it fail from now on. */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireCookieSession();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0 || !(await revokeApiKey(me.address, id))) fail(404, "Key not found");
  return Response.json({ ok: true });
});
