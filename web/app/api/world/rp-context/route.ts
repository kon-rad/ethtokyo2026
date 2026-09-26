import { signRequest } from "@worldcoin/idkit-core/signing";
import { requireSession, handle, fail } from "@/lib/server/http";
import { config } from "@/lib/config";

/** Signs an IDKit proof request. The RP signing key never leaves the server. */
export const POST = handle(async () => {
  await requireSession();
  const signingKeyHex = process.env.WORLD_RP_SIGNING_KEY;
  const rpId = process.env.WORLD_RP_ID;
  if (!signingKeyHex || !rpId) fail(503, "World ID is not configured on this server");

  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex, action: config.worldAction });
  return Response.json({
    rp_context: { rp_id: rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig },
  });
});
