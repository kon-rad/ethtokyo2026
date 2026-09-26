import { sql } from "@/lib/db";
import { residencyAbi } from "@/lib/abi";
import { publicClient } from "@/lib/server/chain";
import { getResidency } from "@/lib/server/residencies";
import { handle, fail, parseAddress } from "@/lib/server/http";

/** Re-reads host() from the contract after a host transfer. The chain is the source of truth, so anyone may call it. */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ address: string }> }) => {
  const address = parseAddress((await ctx.params).address);
  if (!(await getResidency(address))) fail(404, "Residency not found");
  const host = await publicClient.readContract({ address, abi: residencyAbi, functionName: "host" });
  await sql`UPDATE residencies SET host = ${host.toLowerCase()} WHERE address = ${address.toLowerCase()}`;
  return Response.json({ host });
});
