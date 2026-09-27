import { z } from "zod";
import { DEFAULT_QUESTIONS, listRequests, sendRequest } from "@/lib/server/argo";
import { resolveScope } from "@/lib/concierge/knowledge";
import { fail, handle, readJson, requireSession, requireVerified } from "@/lib/server/http";

const body = z.object({
  scope: z.enum(["city", "residency"]),
  key: z.string().min(1),
  questions: z.array(z.string().trim().min(1).max(500)).min(1).max(10).optional(),
});

/** Your requests to your Argo journal and the answers that came back. */
export const GET = handle(async () => {
  const me = await requireSession();
  return Response.json({ requests: await listRequests(me.address) });
});

/**
 * Have a city's or residency's concierge ask your linked Argo journal questions (default: the four
 * matching questions). You answer in Argo; approved answers reach the concierge via the webhook.
 */
export const POST = handle(async (req: Request) => {
  const me = await requireVerified();
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Expected { scope, key, questions? }");
  const scope = await resolveScope(parsed.data.scope, parsed.data.key);
  const request = await sendRequest(req, me, scope, parsed.data.questions ?? DEFAULT_QUESTIONS);
  return Response.json({ request }, { status: 201 });
});
