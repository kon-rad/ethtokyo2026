import { parseSiweMessage } from "viem/siwe";
import { getAddress, type Hex } from "viem";
import { z } from "zod";
import { consumeNonce, startSession, getMe } from "@/lib/server/session";
import { publicClient } from "@/lib/server/chain";
import { fail, handle, readJson } from "@/lib/server/http";

const body = z.object({ message: z.string().min(1).max(4000), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) });

/** Sign-In with Ethereum: checks the nonce, domain and signature (EOA or smart wallet). */
export const POST = handle(async (req: Request) => {
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, "Invalid sign-in payload");
  const { message, signature } = parsed.data;

  const nonce = await consumeNonce();
  if (!nonce) fail(401, "Sign-in expired, try again");

  const fields = parseSiweMessage(message);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!fields.address || fields.nonce !== nonce) fail(401, "Invalid sign-in nonce");
  if (host && fields.domain !== host) fail(401, "Sign-in domain mismatch");

  const valid = await publicClient.verifySiweMessage({ message, signature: signature as Hex, nonce, domain: fields.domain });
  if (!valid) fail(401, "Signature check failed");

  await startSession(getAddress(fields.address));
  return Response.json({ ok: true, me: await getMe() });
});
