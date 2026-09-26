import { z } from "zod";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { sql } from "@/lib/db";
import { getMe } from "@/lib/server/session";
import { requireSession, handle, fail, readJson } from "@/lib/server/http";
import { config } from "@/lib/config";

const body = z.object({
  adult: z.literal(true, { errorMap: () => ({ message: "Confirm you are 18 or older" }) }),
  idkitResult: z
    .object({
      responses: z.array(z.object({ nullifier: z.string().optional(), signal_hash: z.string().optional() }).passthrough()).min(1),
    })
    .passthrough(),
});

/**
 * Verifies a World ID Proof of Human with the Developer Portal, then binds its nullifier to the
 * signed-in wallet. The UNIQUE nullifier column means one wallet per human.
 */
export const POST = handle(async (req: Request) => {
  const me = await requireSession();
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0]?.message ?? "Invalid verification payload");
  const { idkitResult } = parsed.data;

  const rpId = process.env.WORLD_RP_ID;
  if (!rpId) fail(503, "World ID is not configured on this server");

  // Staging (simulator) proofs are only accepted during a Developer Portal staging window, which
  // issues a token that must ride along on every verify call. Production never sends it.
  const headers: Record<string, string> = { "content-type": "application/json" };
  const stagingToken = process.env.WORLD_STAGING_VERIFICATION_TOKEN;
  if (config.worldEnvironment === "staging" && stagingToken) headers["x-staging-verification-token"] = stagingToken;

  const res = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    method: "POST",
    headers,
    body: JSON.stringify(idkitResult),
  });
  const verdict = (await res.json().catch(() => ({}))) as { environment?: string; detail?: string; code?: string };
  if (!res.ok) fail(400, `World ID rejected the proof${verdict.code ? ` (${verdict.code})` : ""}`);
  if (verdict.environment && verdict.environment !== config.worldEnvironment)
    fail(400, `Proof is from the ${verdict.environment} environment`);

  const item = idkitResult.responses[0];
  if (!item.nullifier) fail(400, "Proof has no nullifier");
  const expectedSignal = hashSignal(me.address.toLowerCase());
  if (item.signal_hash && BigInt(item.signal_hash) !== BigInt(expectedSignal))
    fail(400, "This proof was made for a different wallet");

  await storeVerification(me.address.toLowerCase(), BigInt(item.nullifier).toString());
  return Response.json({ ok: true, me: await getMe() });
});

async function storeVerification(address: string, nullifier: string) {
  const [holder] = await sql<{ address: string }[]>`SELECT address FROM users WHERE nullifier = ${nullifier}`;
  if (holder && holder.address !== address) fail(409, "This World ID is already linked to another wallet");

  try {
    await insertVerification(address, nullifier);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") fail(409, "This World ID is already linked to another wallet");
    throw e;
  }
}

async function insertVerification(address: string, nullifier: string) {
  await sql`
    INSERT INTO users (address, nullifier, verified_at, adult_attested_at)
    VALUES (${address}, ${nullifier}, now(), now())
    ON CONFLICT (address) DO UPDATE
      SET nullifier = COALESCE(users.nullifier, EXCLUDED.nullifier),
          verified_at = COALESCE(users.verified_at, now()),
          adult_attested_at = COALESCE(users.adult_attested_at, now())`;
}
