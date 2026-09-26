import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getAddress, type Address } from "viem";
import { sql } from "../db";

const SESSION_COOKIE = "aic_session";
const NONCE_COOKIE = "aic_nonce";
const SESSION_TTL = 7 * 24 * 60 * 60;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function issueNonce(): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const token = await new SignJWT({ nonce }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(secret());
  (await cookies()).set(NONCE_COOKIE, token, { ...cookieBase, maxAge: 600 });
  return nonce;
}

export async function consumeNonce(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(NONCE_COOKIE)?.value;
  store.delete(NONCE_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.nonce === "string" ? payload.nonce : null;
  } catch {
    return null;
  }
}

export async function startSession(address: Address): Promise<void> {
  const token = await new SignJWT({ address })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, maxAge: SESSION_TTL });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionAddress(): Promise<Address | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.address === "string" ? getAddress(payload.address) : null;
  } catch {
    return null;
  }
}

/** `name` is set once the wallet has a directory profile. */
export type Me = { address: Address; verified: boolean; adult: boolean; name: string | null };

export async function getMe(): Promise<Me | null> {
  const address = await getSessionAddress();
  if (!address) return null;
  const [row] = await sql<{ verified_at: Date | null; adult_attested_at: Date | null; name: string | null }[]>`
    SELECT u.verified_at, u.adult_attested_at, p.name
    FROM users u LEFT JOIN profiles p ON p.address = u.address
    WHERE u.address = ${address.toLowerCase()}`;
  return { address, verified: !!row?.verified_at, adult: !!row?.adult_attested_at, name: row?.name ?? null };
}
