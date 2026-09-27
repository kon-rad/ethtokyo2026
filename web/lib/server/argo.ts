import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getAddress, isAddress, recoverMessageAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sql } from "../db";
import { fail } from "./http";
import type { KnowledgeScope } from "@/lib/concierge/knowledge";

/**
 * Argo private AI journal link. The concierge asks a member's Argo questions using Argo's agent
 * info-request protocol (luminalog-oss docs/features/agent-info-requests-protocol.md):
 * an EIP-191 signed request to POST {ARGO_API_URL}/v1/inbox/requests, answered in the Argo app,
 * delivered to our webhook signed by Argo's server key. The journal itself never leaves Argo;
 * only answers the member approved do.
 */

const API_URL = (process.env.ARGO_API_URL || "https://api.luminalog.com").replace(/\/$/, "");
const REQUEST_PREFIX = "Argo information request v1\n";
const RESPONSE_PREFIX = "Argo information response v1\n";

export const DEFAULT_QUESTIONS = [
  "What are you building or working on right now?",
  "Who are you hoping to meet here: a co-founder, a business partner, collaborators, clients?",
  "What skills, experience or help could you offer other people here?",
  "What topics would you love to talk about, or trade knowledge on?",
];

export type ArgoAnswer = { question: string; answer: string | null; declined: boolean };

export type ArgoRequestDto = {
  id: string;
  scope: "city" | "residency";
  key: string;
  handle: string;
  questions: string[];
  status: "pending" | "answered";
  answers: ArgoAnswer[] | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
};

// ------------------------------------------------------------------------------------ link

/** '@name' / 'name' → '@name'; 0x address → checksummed. Argo usernames are 3–20 of [a-z0-9_]. */
export function normalizeHandle(raw: string): string {
  const v = raw.trim();
  if (isAddress(v)) return getAddress(v);
  const name = v.replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(name)) fail(400, "Enter your Argo @username or the 0x wallet address in Argo");
  return `@${name}`;
}

export async function getLink(address: string): Promise<{ handle: string; linkedAt: string } | null> {
  const [row] = await sql<{ handle: string; updated_at: Date }[]>`
    SELECT handle, updated_at FROM argo_links WHERE address = ${address.toLowerCase()}`;
  return row ? { handle: row.handle, linkedAt: row.updated_at.toISOString() } : null;
}

export async function setLink(address: string, handle: string): Promise<void> {
  await sql`
    INSERT INTO argo_links (address, handle) VALUES (${address.toLowerCase()}, ${handle})
    ON CONFLICT (address) DO UPDATE SET handle = EXCLUDED.handle, updated_at = now()`;
}

/** Unlinking also withdraws every answer from the concierges. */
export async function removeLink(address: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM argo_requests WHERE address = ${address.toLowerCase()}`;
    await tx`DELETE FROM argo_links WHERE address = ${address.toLowerCase()}`;
  });
}

// --------------------------------------------------------------------------------- requests

function agentAccount() {
  const key = process.env.ARGO_AGENT_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) fail(503, "The Argo link isn't configured on this server");
  return privateKeyToAccount(key as Hex);
}

/** Where Argo delivers answers. Must be public HTTPS, so local dev needs ARGO_WEBHOOK_URL (a tunnel). */
function webhookUrl(req: Request): string {
  if (process.env.ARGO_WEBHOOK_URL) return process.env.ARGO_WEBHOOK_URL;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) fail(503, "Set ARGO_WEBHOOK_URL");
  return `https://${host}/api/argo/webhook`;
}

const sha256Hex = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

type Body = {
  to: string;
  from: { address: string; name: string; description: string };
  reason: string;
  questions: string[];
  webhookUrl: string;
  issuedAt: string;
  nonce: string;
};

function canonical(b: Body): string {
  return JSON.stringify([
    b.to,
    b.from.address.toLowerCase(),
    "",
    b.from.name,
    b.from.description,
    b.reason,
    b.questions,
    b.webhookUrl,
    b.issuedAt,
    b.nonce,
  ]);
}

const ARGO_ERRORS: Record<string, string> = {
  recipient_not_found: "Argo has no user with that @username or address. Check the handle on your profile.",
  rate_limited: "Argo allows 3 requests a day from the concierge to one person. Try again tomorrow.",
  inbox_full: "Your Argo inbox has 50 pending requests. Answer or clear some first.",
  invalid_webhook: "Argo rejected the webhook URL: it must be public HTTPS.",
};

/** Sign and send the questions to the member's Argo, then remember the request. */
export async function sendRequest(
  req: Request,
  me: { address: string },
  s: KnowledgeScope,
  questions: string[],
): Promise<ArgoRequestDto> {
  const link = await getLink(me.address);
  if (!link) fail(400, "Link your Argo journal on your profile first");
  const account = agentAccount();
  const kind = s.scope === "city" ? "pop-up city" : "residency";

  const body: Body = {
    to: link.handle,
    from: {
      address: account.address,
      name: `AI City concierge: ${s.name}`.slice(0, 80),
      description: `The AI concierge for ${s.name}, a ${kind} on AI City. It introduces the people there to each other.`.slice(0, 500),
    },
    reason: `You asked the ${s.name} concierge on AI City to read your journal for matching. Answers you send go to that concierge, which anyone can chat with, and it uses them to introduce you to a co-founder, partner, opportunity or conversation there. Decline any question you'd rather keep private.`.slice(0, 1000),
    questions,
    webhookUrl: webhookUrl(req),
    issuedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    nonce: randomBytes(16).toString("hex"),
  };
  const hash = sha256Hex(canonical(body));
  const signature = await account.signMessage({ message: REQUEST_PREFIX + hash });

  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/inbox/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, signature }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    fail(502, "Couldn't reach Argo. Try again in a minute.");
  }
  const out = (await res.json().catch(() => ({}))) as { id?: string; expiresAt?: string; error?: string };
  if (res.status !== 201 || !out.id) {
    fail(res.status >= 500 ? 502 : 400, ARGO_ERRORS[out.error ?? ""] ?? `Argo refused the request (${out.error ?? res.status})`);
  }

  const [row] = await sql<Row[]>`
    INSERT INTO argo_requests (id, address, handle, scope, scope_key, reason, questions, expires_at)
    VALUES (${out.id}, ${me.address.toLowerCase()}, ${link.handle}, ${s.scope}, ${s.key}, ${body.reason},
            ${sql.json(questions)}, ${out.expiresAt ?? new Date(Date.now() + 30 * 86400_000).toISOString()})
    RETURNING *`;
  return toDto(row);
}

type Row = {
  id: string;
  scope: "city" | "residency";
  scope_key: string;
  handle: string;
  questions: string[];
  status: "pending" | "answered";
  answers: ArgoAnswer[] | null;
  created_at: Date;
  expires_at: Date;
  responded_at: Date | null;
};

function toDto(r: Row): ArgoRequestDto {
  return {
    id: r.id,
    scope: r.scope,
    key: r.scope_key,
    handle: r.handle,
    questions: r.questions,
    status: r.status,
    answers: r.answers,
    createdAt: r.created_at.toISOString(),
    expiresAt: r.expires_at.toISOString(),
    respondedAt: r.responded_at?.toISOString() ?? null,
  };
}

export async function listRequests(address: string): Promise<ArgoRequestDto[]> {
  const rows = await sql<Row[]>`
    SELECT * FROM argo_requests WHERE address = ${address.toLowerCase()} ORDER BY created_at DESC LIMIT 50`;
  return rows.map(toDto);
}

/** Withdraw one request's answers from the concierge. */
export async function deleteRequest(address: string, id: string): Promise<boolean> {
  const rows = await sql`DELETE FROM argo_requests WHERE id = ${id} AND address = ${address.toLowerCase()} RETURNING id`;
  return rows.length > 0;
}

// ---------------------------------------------------------------------------------- webhook

let pinnedSigner: string | null = null;

/** Argo's response-signing address: ARGO_SIGNER_ADDRESS if set, else fetched once from Argo and pinned. */
async function argoSigner(): Promise<string> {
  if (process.env.ARGO_SIGNER_ADDRESS) return process.env.ARGO_SIGNER_ADDRESS.toLowerCase();
  if (!pinnedSigner) {
    const res = await fetch(`${API_URL}/v1/inbox/signer`, { signal: AbortSignal.timeout(10_000) });
    const { address } = (await res.json()) as { address?: string };
    if (!address || !isAddress(address)) fail(503, "Couldn't fetch Argo's signer");
    pinnedSigner = address.toLowerCase();
  }
  return pinnedSigner;
}

/** Verify an Argo webhook (signature over the raw body, against the pinned signer) and store the answers. */
export async function receiveResponse(raw: string, signature: string | null): Promise<void> {
  if (!signature || !/^0x[0-9a-fA-F]+$/.test(signature)) fail(401, "Missing X-Argo-Signature");
  let signer: string;
  try {
    signer = await recoverMessageAddress({ message: RESPONSE_PREFIX + sha256Hex(raw), signature: signature as Hex });
  } catch {
    fail(401, "Bad signature");
  }
  if (signer.toLowerCase() !== (await argoSigner())) fail(401, "Not signed by Argo");

  let body: { type?: string; requestId?: string; answers?: ArgoAnswer[]; respondedAt?: string };
  try {
    body = JSON.parse(raw);
  } catch {
    fail(400, "Expected JSON");
  }
  if (body.type !== "argo.info-response.v1" || !body.requestId || !Array.isArray(body.answers)) fail(400, "Not an Argo response");

  const answers: ArgoAnswer[] = body.answers.map((a) => ({
    question: String(a.question ?? "").slice(0, 500),
    answer: a.declined || a.answer == null ? null : String(a.answer).slice(0, 4000),
    declined: !!a.declined || a.answer == null,
  }));
  const rows = await sql`
    UPDATE argo_requests SET status = 'answered', answers = ${sql.json(answers)},
      responded_at = ${body.respondedAt ?? new Date().toISOString()}
    WHERE id = ${body.requestId} RETURNING id`;
  if (rows.length === 0) fail(404, "Unknown request");
}

// -------------------------------------------------------------------------------- concierge

/**
 * Approved answers the concierge may use: those given to this residency or its city, or, for a city,
 * to the city or any of its residencies. Declined questions are left out.
 */
export async function argoNotes(s: KnowledgeScope): Promise<string> {
  const keys =
    s.scope === "city"
      ? (
          await sql<{ k: string }[]>`
            SELECT 'residency:' || r.address AS k FROM residencies r JOIN cities c ON c.id = r.city_id
            WHERE c.slug = ${s.key} AND NOT r.hidden`
        )
          .map((r) => r.k)
          .concat(`city:${s.key}`)
      : s.sources.filter((x) => x.scope !== "shared").map((x) => `${x.scope}:${x.key}`);

  const rows = await sql<{ address: string; name: string | null; answers: ArgoAnswer[] }[]>`
    SELECT DISTINCT ON (a.address) a.address, p.name, a.answers
    FROM argo_requests a LEFT JOIN profiles p ON p.address = a.address
    WHERE a.status = 'answered' AND (a.scope || ':' || a.scope_key) = ANY(${keys})
    ORDER BY a.address, a.responded_at DESC`;

  return rows
    .map((r) => {
      const qa = r.answers.filter((a) => !a.declined && a.answer).map((a) => `Q: ${a.question}\nA: ${a.answer}`);
      if (qa.length === 0) return "";
      return `--- ${r.name ?? "A member"} (${getAddress(r.address)}) ---\n${qa.join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");
}
