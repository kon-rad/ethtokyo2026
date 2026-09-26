import { buildConciergePrompt, resolveScope } from "@/lib/concierge/knowledge";
import { chatTogether } from "@/lib/concierge/chat-together";
import { handle, fail, readJson } from "@/lib/server/http";

/** Ask the city's concierge. It answers from the city's listing and knowledge base. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { message } = (await readJson(req)) as { message?: string };
  if (!message?.trim()) fail(400, "message is required");
  const scope = await resolveScope("city", (await ctx.params).slug);
  const { prompt, sources } = await buildConciergePrompt(scope, message.slice(0, 2000));
  return Response.json(await chatTogether(prompt, message.slice(0, 2000), sources));
});
