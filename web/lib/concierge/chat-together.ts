import "server-only";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo";

export type TogetherResponse = {
  response: string;
  suggestions: string[];
  knowledgeSources: string[];
};

/**
 * Send a chat prompt to Together AI (Llama 3.3 70B) and return a structured response.
 * Falls back to a friendly message if TOGETHER_API_KEY is not set.
 */
export async function chatTogether(
  systemPrompt: string,
  userMessage: string,
  knowledgeFilenames: string[],
): Promise<TogetherResponse> {
  const apiKey = process.env.TOGETHER_API_KEY;
  if (!apiKey) {
    return {
      response:
        "The concierge isn't configured yet — the Together AI key is missing. " +
        "Add TOGETHER_API_KEY to .env.local and restart the dev server.",
      suggestions: [
        "What is this city about?",
        "What's the food scene like?",
        "Who else is staying here?",
      ],
      knowledgeSources: [],
    };
  }

  const model = process.env.TOGETHER_MODEL || DEFAULT_MODEL;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];

  try {
    const res = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        response: `The concierge hit a snag reaching the model${
          detail ? `: ${detail.slice(0, 200)}` : ""
        }. Please try again.`,
        suggestions: ["Try asking again", "What's the food scene like?"],
        knowledgeSources: [],
      };
    }

    const json = await res.json();
    const reply = json.choices?.[0]?.message?.content?.trim() ?? "";

    // Ask Llama to generate follow-up suggestions by appending a meta-instruction
    // to the system prompt. We do a second quick call for suggestions.
    const suggestions = await generateSuggestions(apiKey, model, systemPrompt, userMessage, reply);

    return {
      response: reply,
      suggestions,
      knowledgeSources: knowledgeFilenames,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      response: `Sorry, the concierge encountered an error: ${msg.slice(0, 200)}`,
      suggestions: ["Try asking again", "What's the food scene like?"],
      knowledgeSources: [],
    };
  }
}

/**
 * Generate 3-4 follow-up suggestion questions based on the conversation.
 * Uses a cheap/fast second call.
 */
async function generateSuggestions(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
  reply: string,
): Promise<string[]> {
  const suggestionPrompt = `Based on this conversation, suggest 3-4 short follow-up questions the user might want to ask next. Return ONLY a JSON array of strings, nothing else. No markdown, no explanation.

User: ${userMessage}
Assistant: ${reply}`;

  try {
    const res = await fetch(TOGETHER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: suggestionPrompt }],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";

    // Try to parse as JSON array
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.slice(0, 4);
    } catch {
      // Fall back to extracting questions from the text
      const lines = text
        .split("\n")
        .map((l: string) => l.replace(/^[\d.\[\]()"'\s-]+/, "").trim())
        .filter((l: string) => l.length > 5 && l.length < 120);
      return lines.slice(0, 4);
    }
  } catch {
    return [];
  }

  return [];
}