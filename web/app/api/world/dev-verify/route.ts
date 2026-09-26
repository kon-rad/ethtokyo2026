import { sql } from "@/lib/db";
import { getMe } from "@/lib/server/session";
import { requireSession, handle, fail } from "@/lib/server/http";

/**
 * LOCAL DEVELOPMENT ONLY: marks the signed-in wallet as verified without World ID, so the full
 * flow can be exercised on anvil. Disabled unless ALLOW_DEV_VERIFY=1 and not in production.
 */
export const POST = handle(async () => {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_VERIFY !== "1") fail(404, "Not found");
  const me = await requireSession();
  await sql`
    INSERT INTO users (address, verified_at, adult_attested_at) VALUES (${me.address.toLowerCase()}, now(), now())
    ON CONFLICT (address) DO UPDATE SET verified_at = now(), adult_attested_at = now()`;
  return Response.json({ ok: true, me: await getMe() });
});
