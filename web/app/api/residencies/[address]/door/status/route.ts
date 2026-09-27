import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { sql } from "@/lib/db";
import { getResidency } from "@/lib/server/residencies";
import { handle, fail, parseAddress, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ address: string }> };

export type DoorStatus = {
  status: "checking" | "opening" | "denied" | "open" | "locked";
  message: string;
  /** Seconds since this status began, and since it was last posted (server clock). */
  elapsedS: number;
  ageS: number;
} | null;

/**
 * GET — the board polls this for the door's live state (checking, opening, open, denied).
 * Returns null if the door has never posted.
 */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const address = parseAddress((await ctx.params).address);
  if (!(await getResidency(address))) fail(404, "Residency not found");
  const [row] = await sql<{ status: NonNullable<DoorStatus>["status"]; message: string; elapsed_s: number; age_s: number }[]>`
    SELECT status, message,
           EXTRACT(EPOCH FROM now() - started_at)::float8 AS elapsed_s,
           EXTRACT(EPOCH FROM now() - updated_at)::float8 AS age_s
    FROM door_status WHERE residency = ${address.toLowerCase()}`;
  const out: DoorStatus = row
    ? { status: row.status, message: row.message, elapsedS: row.elapsed_s, ageS: row.age_s }
    : null;
  return Response.json(out);
});

const body = z.object({
  status: z.enum(["checking", "opening", "denied", "open", "locked"]),
  message: z.string().max(200).optional(),
});

function keyMatches(given: string | null): boolean {
  const expected = process.env.DOOR_API_KEY;
  if (!expected || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST — the door script (hardware/pi4/pi4-door.py) sends its current state.
 * Auth: the x-door-key header must equal DOOR_API_KEY.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const address = parseAddress((await ctx.params).address);
  if (!keyMatches(req.headers.get("x-door-key"))) fail(403, "Unauthorized");
  if (!(await getResidency(address))) fail(404, "Residency not found");

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0].message);

  await sql`
    INSERT INTO door_status (residency, status, message)
    VALUES (${address.toLowerCase()}, ${parsed.data.status}, ${parsed.data.message ?? ""})
    ON CONFLICT (residency) DO UPDATE SET
      started_at = CASE WHEN door_status.status = EXCLUDED.status
                        THEN door_status.started_at ELSE now() END,
      status = EXCLUDED.status,
      message = EXCLUDED.message,
      updated_at = now()`;
  return Response.json({ ok: true });
});
