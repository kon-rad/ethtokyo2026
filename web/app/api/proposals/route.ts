import { listProposals } from "@/lib/server/proposals";
import { requireSession, handle } from "@/lib/server/http";

/** The signed-in wallet's own proposals, in every city. */
export const GET = handle(async () => {
  const me = await requireSession();
  return Response.json({ proposals: await listProposals({ proposer: me.address }) });
});
