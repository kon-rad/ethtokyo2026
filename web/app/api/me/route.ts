import { getMe } from "@/lib/server/session";
import { handle } from "@/lib/server/http";

export const GET = handle(async () => {
  return Response.json({ me: await getMe() });
});
