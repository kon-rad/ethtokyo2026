import { deleteRequest } from "@/lib/server/argo";
import { fail, handle, requireSession } from "@/lib/server/http";

/** Withdraw one request's answers from the concierge (Argo keeps nothing either way). */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await requireSession();
  if (!(await deleteRequest(me.address, (await ctx.params).id))) fail(404, "Request not found");
  return Response.json({ ok: true });
});
