import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, recoverMessageAddress, type Address, type Hex } from "viem";
import { sql } from "../db";
import { fail } from "./http";
import type { ResidencyDto } from "./residencies";

// The house door (hardware/pi4/pi4-door.py) asks for a challenge, the guest's Pi Zero signs
// doorMessage() with its wallet (hardware/pi-zero/zero-tx-signer.py), and the door posts the
// signature here. The challenge is 32 bytes: an 8-byte issue time, 8 random bytes and a 16-byte
// HMAC of both, so the server needs no table of open challenges, and door_checkins.challenge makes
// each one single-use.

const CHALLENGE_TTL = 5 * 60; // seconds; the Zero can take a minute to boot after it's plugged in

/** Must match door_message() in pi4-door.py and zero-tx-signer.py. */
export function doorMessage(residency: string, challenge: string): string {
  return `AI City door access\nresidency: ${residency.toLowerCase()}\nchallenge: ${challenge}`;
}

function mac(residency: string, issuedAndNonce: string): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return createHmac("sha256", `door:${s}`)
    .update(`${residency.toLowerCase()}:${issuedAndNonce}`)
    .digest("hex")
    .slice(0, 32);
}

export function issueChallenge(residency: string): string {
  const head = Math.floor(Date.now() / 1000).toString(16).padStart(16, "0") + randomBytes(8).toString("hex");
  return head + mac(residency, head);
}

function checkChallenge(residency: string, challenge: string) {
  if (!/^[0-9a-f]{64}$/.test(challenge)) fail(400, "Malformed challenge");
  const head = challenge.slice(0, 32);
  const expected = Buffer.from(mac(residency, head));
  if (!timingSafeEqual(Buffer.from(challenge.slice(32)), expected)) fail(400, "Unknown challenge");
  const age = Date.now() / 1000 - parseInt(challenge.slice(0, 16), 16);
  if (age < 0 || age > CHALLENGE_TTL) fail(400, "Challenge expired");
}

export type Checkin = { address: Address; direction: "in" | "out"; at: string };

/** Verifies the guest's signature over a fresh challenge and records the in/out toggle. */
export async function recordCheckin(residency: string, challenge: string, signature: Hex): Promise<Checkin> {
  checkChallenge(residency, challenge);
  let signer: Address;
  try {
    signer = await recoverMessageAddress({ message: doorMessage(residency, challenge), signature });
  } catch {
    fail(400, "Bad signature");
  }
  const who = signer.toLowerCase();
  const [row] = await sql<{ direction: "in" | "out"; created_at: Date }[]>`
    INSERT INTO door_checkins (residency, address, direction, challenge)
    SELECT ${residency.toLowerCase()}, ${who},
      CASE WHEN (SELECT direction FROM door_checkins
                 WHERE residency = ${residency.toLowerCase()} AND address = ${who}
                 ORDER BY created_at DESC, id DESC LIMIT 1) = 'in' THEN 'out' ELSE 'in' END,
      ${challenge}
    ON CONFLICT (challenge) DO NOTHING
    RETURNING direction, created_at`;
  if (!row) fail(409, "Challenge already used");
  return { address: signer, direction: row.direction, at: row.created_at.toISOString() };
}

export type Occupant = {
  address: Address;
  name: string | null; // listed profile name only: the board is a public page
  seat: string | null; // "Host", or the bed from the guest's approved application
  since: string;
};

export type DoorEvent = { address: Address; name: string | null; direction: "in" | "out"; at: string };

export type Presence = { inside: Occupant[]; recent: DoorEvent[] };

export async function getPresence(residency: ResidencyDto): Promise<Presence> {
  const r = residency.address.toLowerCase();
  const [latest, recent] = await Promise.all([
    sql<{ address: string; direction: "in" | "out"; created_at: Date }[]>`
      SELECT DISTINCT ON (address) address, direction, created_at FROM door_checkins
      WHERE residency = ${r} ORDER BY address, created_at DESC, id DESC`,
    sql<{ address: string; direction: "in" | "out"; created_at: Date }[]>`
      SELECT address, direction, created_at FROM door_checkins
      WHERE residency = ${r} ORDER BY created_at DESC, id DESC LIMIT 8`,
  ]);
  const addresses = [...new Set([...latest, ...recent].map((x) => x.address))];
  const [profiles, beds] = addresses.length
    ? await Promise.all([
        sql<{ address: string; name: string }[]>`
          SELECT address, name FROM profiles WHERE listed AND address IN ${sql(addresses)}`,
        sql<{ applicant: string; bed_id: number }[]>`
          SELECT lower(applicant) AS applicant, bed_id FROM applications
          WHERE residency = ${r} AND status = 'approved' AND bed_id IS NOT NULL
            AND lower(applicant) IN ${sql(addresses)}`,
      ])
    : [[], []];
  const nameOf = new Map(profiles.map((p) => [p.address, p.name]));
  const bedLabel = new Map(
    residency.metadata.rooms.flatMap((room) => room.beds.map((b) => [b.id, `${b.label} · ${room.name}`] as const)),
  );
  const bedOf = new Map(beds.map((b) => [b.applicant, bedLabel.get(b.bed_id) ?? `Bed ${b.bed_id}`]));
  const seatOf = (a: string) => (a === residency.host.toLowerCase() ? "Host" : (bedOf.get(a) ?? null));

  return {
    inside: latest
      .filter((x) => x.direction === "in")
      .sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
      .map((x) => ({
        address: getAddress(x.address),
        name: nameOf.get(x.address) ?? null,
        seat: seatOf(x.address),
        since: x.created_at.toISOString(),
      })),
    recent: recent.map((x) => ({
      address: getAddress(x.address),
      name: nameOf.get(x.address) ?? null,
      direction: x.direction,
      at: x.created_at.toISOString(),
    })),
  };
}
