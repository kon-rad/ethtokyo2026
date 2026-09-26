import { endSession } from "@/lib/server/session";
import { handle } from "@/lib/server/http";

export const POST = handle(async () => {
  await endSession();
  return Response.json({ ok: true });
});
