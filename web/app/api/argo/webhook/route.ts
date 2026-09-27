import { receiveResponse } from "@/lib/server/argo";
import { handle } from "@/lib/server/http";

/** Argo delivers approved answers here, signed by its pinned server key over the raw body. */
export const POST = handle(async (req: Request) => {
  await receiveResponse(await req.text(), req.headers.get("x-argo-signature"));
  return Response.json({ ok: true });
});
