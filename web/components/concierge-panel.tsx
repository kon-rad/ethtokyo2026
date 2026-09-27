"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useSession } from "@/components/session";

type Message = {
  role: "user" | "assistant";
  content: string;
  knowledgeSources?: string[];
};

type Props = {
  scope: "city" | "residency";
  slugOrAddress: string;
  name: string;
};

export function ConciergePanel({ scope, slugOrAddress, name }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Hey! I'm the ${name} concierge. I can help you find the right people to connect with, answer questions about the place, or tell you what's nearby. What are you looking for?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Who else is staying here?",
    "What's the food scene like?",
    "How do I get from the airport?",
  ]);
  const listRef = useRef<HTMLDivElement>(null);
  const { signedIn } = useSession();
  const [argoNeedsLink, setArgoNeedsLink] = useState(false);

  /** Have this concierge send its matching questions to the member's linked Argo journal. */
  async function askArgo() {
    if (loading) return;
    setMessages((prev) => [...prev, { role: "user", content: "Ask my Argo journal" }]);
    setLoading(true);
    setArgoNeedsLink(false);
    try {
      const res = await fetch("/api/argo/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, key: slugOrAddress }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (/link your argo/i.test(data.error ?? "")) setArgoNeedsLink(true);
        throw new Error(data.error ?? "Couldn't reach Argo");
      }
      const n = data.request.questions.length;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I sent ${n} questions to your Argo journal (${data.request.handle}). Open Argo → Inbox, answer or decline each one, and send. Once your answers arrive I'll use them to introduce you to people here. Ask me "who should I meet?" after that.`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: err instanceof Error ? err.message : "Couldn't reach Argo" }]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const endpoint =
        scope === "city"
          ? `/api/concierge/city/${slugOrAddress}`
          : `/api/concierge/residency/${slugOrAddress}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      const botMsg: Message = {
        role: "assistant",
        content: data.response || "Sorry, I couldn't process that.",
        knowledgeSources: data.knowledgeSources,
      };
      setMessages((prev) => [...prev, botMsg]);
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Try again?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition hover:bg-black active:scale-95"
        aria-label="Toggle concierge"
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl transition-all duration-200 ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
        style={{ maxHeight: "min(600px, 70vh)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-100 text-sm">
            💬
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name} Concierge</p>
            <p className="text-xs text-muted">AI City concierge</p>
          </div>
          {signedIn && (
            <button
              onClick={askArgo}
              disabled={loading}
              className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:border-indigo-300 disabled:opacity-50"
              title="Send this concierge's matching questions to your linked Argo private journal"
            >
              Ask my Argo journal
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-gray-900 text-white"
                    : "border border-line bg-gray-50 text-foreground"
                }`}
              >
                {m.content}
                {m.knowledgeSources && m.knowledgeSources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.knowledgeSources.map((src) => (
                      <span key={src} className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-line bg-gray-50 px-4 py-2.5 text-sm text-muted">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>

        {argoNeedsLink && (
          <div className="border-t border-line px-5 py-2 text-xs">
            <Link href="/me" className="font-medium text-indigo-600 underline">
              Link your Argo journal on your profile →
            </Link>
          </div>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && !loading && (
          <div className="border-t border-line px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-line bg-gray-50 px-3 py-1 text-xs text-muted transition hover:border-gray-300 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-line px-5 py-3">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(input);
              }}
              placeholder="Ask me anything..."
              className="min-w-0 flex-1 rounded-xl border border-line bg-gray-50 px-3.5 py-2 text-sm outline-none transition focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10"
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-black disabled:bg-gray-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}