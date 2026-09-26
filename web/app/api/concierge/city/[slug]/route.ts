import { loadCityKnowledge, buildConciergePrompt } from "@/lib/concierge/knowledge";
import { chatTogether } from "@/lib/concierge/chat-together";
import { handle, fail, readJson } from "@/lib/server/http";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  const { message, userAddress } = (await readJson(req)) as {
    message?: string;
    userAddress?: string;
  };

  if (!message) fail(400, "message is required");

  const knowledge = loadCityKnowledge(slug);
  const cityName = slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const systemPrompt = buildConciergePrompt(`city "${cityName}"`, cityName, knowledge);
  const filenames = knowledge.map((f) => f.filename);

  const result = await chatTogether(systemPrompt, message, filenames);

  return Response.json(result);
});