// Argo journal link, end to end against the dev server and the REAL Argo API.
// The request goes to a handle that doesn't exist, so Argo verifies our signature and canonical
// payload (it checks those before looking up the recipient) and nobody's inbox is touched.
// Webhook: signed with a throwaway key, so the dev server needs ARGO_SIGNER_ADDRESS set to it
// (pass --webhook after setting it; the script prints the address to use).
//   node scripts/e2e-argo.mjs            → link + request + webhook rejection
//   node scripts/e2e-argo.mjs --webhook  → also a signed delivery and the concierge picking it up
import { createHash } from "node:crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import postgres from "postgres";

const BASE = process.env.BASE ?? "http://localhost:3100";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 11155111);
const CITY = process.env.CITY ?? "zion";
const WEBHOOK_KEY = "0x" + "ab".repeat(32); // test-only Argo stand-in
const sql = postgres(process.env.DATABASE_URL ?? "postgres://localhost/ai_city_sepolia");

let pass = 0, failN = 0;
const check = (ok, what) => {
  if (ok) pass++;
  else failN++;
  console.log(`${ok ? "✓" : "✗"} ${what}`);
};

const account = privateKeyToAccount(generatePrivateKey());
const cookies = new Map();
async function call(path, { method = "GET", json, headers = {}, raw } = {}) {
  const h = new Headers(headers);
  if (cookies.size) h.set("cookie", [...cookies].map(([k, v]) => `${k}=${v}`).join("; "));
  if (json) h.set("content-type", "application/json");
  const res = await fetch(BASE + path, { method, headers: h, body: raw ?? (json ? JSON.stringify(json) : undefined) });
  for (const c of res.headers.getSetCookie()) {
    const [k, v] = c.split(";")[0].split("=");
    if (v) cookies.set(k, v);
    else cookies.delete(k);
  }
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// sign in
const { data: n } = await call("/api/auth/nonce");
const message = createSiweMessage({ domain: new URL(BASE).host, address: account.address, statement: "Sign in to AI City.", uri: BASE, version: "1", chainId: CHAIN_ID, nonce: n.nonce });
const si = await call("/api/auth/verify", { method: "POST", json: { message, signature: await account.signMessage({ message }) } });
check(si.status === 200, `sign in (${si.status})`);
const unverified = await call("/api/argo/link", { method: "PUT", json: { handle: "@zz_nobody_e2e" } });
check(unverified.status === 403, `linking before World ID → 403 (${unverified.status} ${unverified.data.error})`);
// Stand-in for World ID: mark the throwaway wallet verified in the local DB.
await sql`INSERT INTO users (address, verified_at, adult_attested_at) VALUES (${account.address.toLowerCase()}, now(), now())`;

check((await call("/api/argo/link")).data.link === null, "no link yet");
const noLink = await call("/api/argo/requests", { method: "POST", json: { scope: "city", key: CITY } });
check(noLink.status === 400 && /link your argo/i.test(noLink.data.error), "asking without a link → 400");
check((await call("/api/argo/link", { method: "PUT", json: { handle: "a b" } })).status === 400, "bad handle → 400");
const linked = await call("/api/argo/link", { method: "PUT", json: { handle: "@ZZ_nobody_e2e" } });
check(linked.data.link?.handle === "@zz_nobody_e2e", `linked as ${linked.data.link?.handle}`);

// real Argo: signature accepted, recipient unknown
const r = await call("/api/argo/requests", { method: "POST", json: { scope: "city", key: CITY } });
check(r.status === 400 && /no user with that/i.test(r.data.error), `real Argo verified our signature, then 404'd the recipient: ${r.data.error}`);

// webhook rejections
const body = JSON.stringify({ type: "argo.info-response.v1", requestId: "x", answers: [], respondedAt: new Date().toISOString() });
check((await call("/api/argo/webhook", { method: "POST", raw: body, headers: { "content-type": "application/json" } })).status === 401, "webhook without signature → 401");
const forger = privateKeyToAccount(WEBHOOK_KEY);
const sig = (b) => forger.signMessage({ message: "Argo information response v1\n" + createHash("sha256").update(b).digest("hex") });

if (!process.argv.includes("--webhook")) {
  const w = await call("/api/argo/webhook", { method: "POST", raw: body, headers: { "x-argo-signature": await sig(body) } });
  check(w.status === 401, `webhook signed by a non-Argo key → 401 (${w.data.error})`);
  console.log(`\nFor --webhook, set ARGO_SIGNER_ADDRESS=${forger.address} on the dev server.`);
} else {
  // A pending request as if Argo had accepted it, then Argo's delivery.
  const id = createHash("sha256").update(account.address + Date.now()).digest("hex");
  await sql`INSERT INTO profiles (address, name) VALUES (${account.address.toLowerCase()}, 'E2E Argo Tester') ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO argo_requests (id, address, handle, scope, scope_key, reason, questions, expires_at)
            VALUES (${id}, ${account.address.toLowerCase()}, '@zz_nobody_e2e', 'city', ${CITY}, 'test', ${sql.json(["What are you building?", "Who do you want to meet?"])}, now() + interval '30 days')`;
  const reply = JSON.stringify({
    type: "argo.info-response.v1", requestId: id, respondent: { username: "zz_nobody_e2e", wallet: null },
    answers: [
      { question: "What are you building?", answer: "A solar-powered drone mapping kit for rice farmers.", declined: false },
      { question: "Who do you want to meet?", answer: null, declined: true },
    ],
    respondedAt: new Date().toISOString(),
  });
  const tampered = reply.replace("rice", "corn");
  check((await call("/api/argo/webhook", { method: "POST", raw: tampered, headers: { "x-argo-signature": await sig(reply) } })).status === 401, "tampered body → 401");
  const ok = await call("/api/argo/webhook", { method: "POST", raw: reply, headers: { "x-argo-signature": await sig(reply) } });
  check(ok.status === 200, `signed delivery accepted (${ok.status} ${ok.data.error ?? ""})`);
  const again = await call("/api/argo/webhook", { method: "POST", raw: reply, headers: { "x-argo-signature": await sig(reply) } });
  check(again.status === 200, "redelivery is idempotent");
  const mine = await call("/api/argo/requests");
  const got = mine.data.requests?.find((x) => x.id === id);
  check(got?.status === "answered" && got.answers[1].declined === true, "answers stored, declined kept as declined");

  const c = await call(`/api/concierge/city/${CITY}`, { method: "POST", json: { message: "I'm into drones and farming. Who should I meet?" } });
  check(c.data.knowledgeSources?.includes("argo · member notes"), `concierge reads member notes → "${(c.data.response ?? "").slice(0, 160)}…"`);

  check((await call(`/api/argo/requests/${id}`, { method: "DELETE" })).status === 200, "remove from concierge");
  const c2 = await call(`/api/concierge/city/${CITY}`, { method: "POST", json: { message: "Who should I meet?" } });
  check(!c2.data.knowledgeSources?.includes("argo · member notes"), "gone from the concierge after removal");
}

// clean up
check((await call("/api/argo/link", { method: "DELETE" })).status === 200, "unlink");
await sql`DELETE FROM argo_requests WHERE address = ${account.address.toLowerCase()}`;
await sql`DELETE FROM profiles WHERE address = ${account.address.toLowerCase()}`;
await sql`DELETE FROM users WHERE address = ${account.address.toLowerCase()}`;
await sql.end();
console.log(`\n${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
