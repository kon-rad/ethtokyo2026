import { prepareTx, siteOrigin, txInput } from "@/lib/server/tx";
import { requireSession, handle, fail, readJson } from "@/lib/server/http";

/**
 * Prepare the transactions for an onchain action, for an agent to hand to its human. Returns the
 * calldata to sign, the page that does the same in one click, and what to report once it's mined.
 * Nothing is signed or sent here.
 */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const parsed = txInput.safeParse(await readJson(req));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(400, issue ? `${issue.path.join(".") || "action"}: ${issue.message}` : "Invalid action");
  }
  return Response.json(await prepareTx(parsed.data, me, siteOrigin(req)));
});
