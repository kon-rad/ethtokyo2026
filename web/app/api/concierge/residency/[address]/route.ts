import { loadResidencyKnowledge, buildConciergePrompt } from "@/lib/concierge/knowledge";
import { chatTogether } from "@/lib/concierge/chat-together";
import { handle, fail, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ address: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { address } = await ctx.params;
  const { message, userAddress } = (await readJson(req)) as {
    message?: string;
    userAddress?: string;
  };

  if (!message) fail(400, "message is required");

  const knowledge = loadResidencyKnowledge(address);
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const systemPrompt = buildConciergePrompt(`residency ${shortAddress}`, `Residency ${shortAddress}`, knowledge);
  const filenames = knowledge.map((f) => f.filename);

  const result = await chatTogether(systemPrompt, message, filenames);

  return Response.json(result);
});