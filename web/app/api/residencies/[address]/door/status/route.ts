import { z } from "zod";
import { sql } from "@/lib/db";
import { getResidency } from "@/lib/server/residencies";
import { handle, fail, parseAddress, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ address: string }> };

/**
 * GET — board polls this for real-time door status (checking, denied, open).
 * Returns the latest status or null if the door is idle.
 */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const address = parseAddress((await ctx.params).address);
  if (!(await getResidency(address))) fail(404, "Residency not found");
  const [row] = await sql<{ status: string; message: string; updated_at: Date }[]>`
    SELECT status, message, updated_at FROM door_status
    WHERE residency = ${address.toLowerCase()}
    ORDER BY updated_at DESC LIMIT 1`;
  if (!row) return Response.json(null);
  return Response.json({
    status: row.status,
    message: row.message,
    at: row.updated_at.toISOString(),
  });
});

const body = z.object({
  status: z.enum(["checking", "opening", "denied", "open", "locked"]),
  message: z.string().max(200).optional(),
});

/**
 * POST — the door script (pi4-door.py) sends its current state.
 * Requires the door API key in DOOR_API_KEY env var.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const address = parseAddress((await ctx.params).address);
  if (!(await getResidency(address))) fail(404, "Residency not found");

  // Simple shared-secret auth: the door script carries DOOR_API_KEY
  const auth = req.headers.get("x-door-key");
  const expected = process.env.DOOR_API_KEY;
  if (!expected || !auth || auth !== expected) fail(403, "Unauthorized");

  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) fail(400, parsed.error.issues[0].message);

  await sql`
    INSERT INTO door_status (residency, status, message)
    VALUES (${address.toLowerCase()}, ${parsed.data.status}, ${parsed.data.message ?? ""})
    ON CONFLICT (residency, status, message)
    DO UPDATE SET updated_at = NOW()
    WHERE door_status.residency = ${address.toLowerCase()}`;
  return Response.json({ ok: true });
});