import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getAddress, type Address } from "viem";
import { sql } from "../db";

export const MAX_ACTIVE_KEYS = 10;
const KEY_PATTERN = /^aic_[A-Za-z0-9_-]{43}$/;

export type ApiKeyDto = { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** A new key for `address`. The plaintext is returned once and never stored. */
export async function createApiKey(address: Address, name: string): Promise<{ key: string; apiKey: ApiKeyDto }> {
  const key = `aic_${randomBytes(32).toString("base64url")}`;
  const [row] = await sql<{ id: string; created_at: Date }[]>`
    INSERT INTO api_keys (address, name, prefix, key_hash)
    VALUES (${address.toLowerCase()}, ${name}, ${key.slice(0, 12)}, ${hashKey(key)})
    RETURNING id, created_at`;
  return { key, apiKey: { id: Number(row.id), name, prefix: key.slice(0, 12), createdAt: row.created_at.toISOString(), lastUsedAt: null } };
}

export async function listApiKeys(address: Address): Promise<ApiKeyDto[]> {
  const rows = await sql<{ id: string; name: string; prefix: string; created_at: Date; last_used_at: Date | null }[]>`
    SELECT id, name, prefix, created_at, last_used_at FROM api_keys
    WHERE address = ${address.toLowerCase()} AND revoked_at IS NULL
    ORDER BY created_at DESC`;
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    prefix: r.prefix,
    createdAt: r.created_at.toISOString(),
    lastUsedAt: r.last_used_at?.toISOString() ?? null,
  }));
}

/** True if a key was revoked; false if it doesn't exist, isn't theirs, or was already revoked. */
export async function revokeApiKey(address: Address, id: number): Promise<boolean> {
  const rows = await sql`
    UPDATE api_keys SET revoked_at = now()
    WHERE id = ${id} AND address = ${address.toLowerCase()} AND revoked_at IS NULL
    RETURNING id`;
  return rows.length > 0;
}

/** The wallet a live key acts as, or null. Records use at most once a minute. */
export async function addressForApiKey(key: string): Promise<Address | null> {
  if (!KEY_PATTERN.test(key)) return null;
  const hash = hashKey(key);
  const [row] = await sql<{ address: string }[]>`
    SELECT address FROM api_keys WHERE key_hash = ${hash} AND revoked_at IS NULL`;
  if (!row) return null;
  await sql`
    UPDATE api_keys SET last_used_at = now()
    WHERE key_hash = ${hash} AND (last_used_at IS NULL OR last_used_at < now() - interval '1 minute')`;
  return getAddress(row.address);
}
