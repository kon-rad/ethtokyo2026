import { tools, type Call } from "@/lib/server/mcp-tools";
import { siteOrigin } from "@/lib/server/tx";

/**
 * MCP server (Streamable HTTP, stateless, JSON responses). Agents connect with
 * `Authorization: Bearer aic_…`; public tools also work without a key. Every tool runs an HTTP
 * route's handler in-process (lib/server/mcp-tools.ts), so both surfaces behave identically.
 */

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS = `AI City is Luma for pop-up cities. A city is a place and a time window. Inside it, verified humans propose residencies, the core team approves them, and the proposer deploys each one as its own Residency contract holding guests' USDC.
You act for one human, whose API key you hold. You never hold their wallet: for anything onchain call prepare_transaction, give your human the steps or the page, wait for them to sign, then report the hash with the matching record_ tool and check the result.
Ask your human before anything other people see or that commits them: launching a city, proposing, applying, reviewing, denying. Never invent their details. Times are unix seconds; USDC amounts are decimal strings. The contracts are unaudited: say so before your human pays.
Full guide: /skill.md on this site.`;

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const ok = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

async function runTool(outer: Request, call: Call) {
  const url = new URL(call.path, siteOrigin(outer));
  for (const [k, v] of Object.entries(call.query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));

  const headers = new Headers();
  for (const h of ["authorization", "host", "x-forwarded-host", "x-forwarded-proto"]) {
    const v = outer.headers.get(h);
    if (v) headers.set(h, v);
  }
  let body: BodyInit | undefined;
  if (call.form) {
    const form = new FormData();
    for (const [k, v] of Object.entries(call.form))
      form.set(k, typeof v === "string" ? v : new File([Buffer.from(v.base64, "base64")], v.filename, { type: v.mimeType }));
    body = form;
  } else if (call.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(call.json);
  }

  const res = await call.handler(new Request(url, { method: call.method, headers, body }), { params: Promise.resolve(call.params ?? {}) });
  const data = (res.headers.get("content-type") ?? "").includes("json") ? await res.json() : { status: res.status };
  if (!res.ok) {
    const message = (data as { error?: string }).error ?? `Request failed (${res.status})`;
    return { content: [{ type: "text", text: `Error ${res.status}: ${message}` }], isError: true };
  }
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
}

async function dispatch(req: Request, msg: RpcRequest) {
  const { id, method, params = {} } = msg;
  switch (method) {
    case "initialize": {
      const asked = String(params.protocolVersion ?? "");
      return ok(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "ai-city", title: "AI City", version: "1.0.0" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, {
        tools: tools.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })),
      });
    case "tools/call": {
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) return err(id, -32602, `Unknown tool: ${String(params.name)}`);
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        return ok(id, await runTool(req, tool.call(args)));
      } catch (e) {
        console.error(e);
        return ok(id, { content: [{ type: "text", text: "Error: something went wrong running this tool" }], isError: true });
      }
    }
    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(req: Request) {
  // DNS-rebinding guard: a browser page on another origin can't drive this endpoint.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(siteOrigin(req)).host)
    return Response.json(err(null, -32600, "Origin not allowed"), { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(err(null, -32700, "Parse error"), { status: 400 });
  }
  const messages = (Array.isArray(body) ? body : [body]) as RpcRequest[];
  if (messages.some((m) => !m || m.jsonrpc !== "2.0" || typeof m.method !== "string"))
    return Response.json(err(null, -32600, "Invalid request"), { status: 400 });

  // Notifications (no id) get no response.
  const replies = await Promise.all(messages.filter((m) => m.id !== undefined).map((m) => dispatch(req, m)));
  if (replies.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? replies : replies[0]);
}

/** No server-initiated stream: this server is stateless and answers every POST directly. */
export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export const DELETE = GET;
