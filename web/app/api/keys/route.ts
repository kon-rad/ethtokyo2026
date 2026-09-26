import { z } from "zod";
import { createApiKey, listApiKeys, MAX_ACTIVE_KEYS } from "@/lib/server/api-keys";
import { requireCookieSession, handle, fail, readJson } from "@/lib/server/http";

/** Your live API keys (never the keys themselves). */
export const GET = handle(async () => {
  const me = await requireCookieSession();
  return Response.json({ keys: await listApiKeys(me.address) });
});

const body = z.object({ name: z.string().trim().min(1, "Name the key, e.g. the agent that will use it").max(60) });

/** Create a key for an agent. The response is the only time the key is shown. */
export const POST = handle(async (req: Request) => {
  const me = await requireCookieSession();
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Invalid key name");
  if ((await listApiKeys(me.address)).length >= MAX_ACTIVE_KEYS)
    fail(400, `You have ${MAX_ACTIVE_KEYS} keys already. Revoke one first`);
  return Response.json(await createApiKey(me.address, parsed.data.name), { status: 201 });
});
