// End-to-end test of the agent surface: API keys, the MCP server and POST /api/tx. The whole
// city → residency → stay lifecycle is driven by "agents" over MCP with API keys. The wallets
// only sign in once (to create the keys) and sign the exact steps prepare_transaction returns.
// Same local stack as e2e-local.mjs: anvil + DeployLocal + Postgres + `pnpm dev` with ALLOW_DEV_VERIFY=1.
//   node scripts/e2e-agent.mjs [baseUrl]
import { createPublicClient, createWalletClient, http, parseUnits, parseAbi, sha256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { createSiweMessage } from "viem/siwe";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3100";
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? env.NEXT_PUBLIC_USDC_ADDRESS;
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
];
const pub = createPublicClient({ chain: anvil, transport: http() });
const usdc = (n) => parseUnits(String(n), 6);
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)", "function mint(address,uint256)", "function transfer(address,uint256) returns (bool)"]);
const residencyAbi = parseAbi(["function seatCount() view returns (uint32)", "function status() view returns (uint8)"]);
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

class Human {
  constructor(key, name) {
    this.name = name;
    this.account = privateKeyToAccount(key);
    this.wallet = createWalletClient({ account: this.account, chain: anvil, transport: http() });
    this.cookie = "";
    this.apiKey = "";
    this.rpcId = 0;
  }
  // Browser session: only used to sign in, verify and create the agent's key.
  async web(path, init = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    if (init.json) headers.set("content-type", "application/json");
    const res = await fetch(BASE + path, { ...init, headers, body: init.json ? JSON.stringify(init.json) : init.body });
    const set = res.headers.getSetCookie().map((c) => c.split(";")[0]).filter((c) => !c.endsWith("="));
    if (set.length) this.cookie = [...new Map([...this.cookie.split("; ").filter(Boolean), ...set].map((c) => [c.split("=")[0], c])).values()].join("; ");
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  async signIn() {
    const { data } = await this.web("/api/auth/nonce");
    const message = createSiweMessage({
      domain: new URL(BASE).host, address: this.account.address, statement: "Sign in to AI City.",
      uri: BASE, version: "1", chainId: anvil.id, nonce: data.nonce,
    });
    return this.web("/api/auth/verify", { method: "POST", json: { message, signature: await this.wallet.signMessage({ message }) } });
  }
  // The agent: MCP over HTTP with the API key, no cookie.
  async rpc(method, params, key = this.apiKey) {
    const res = await fetch(`${BASE}/api/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++this.rpcId, method, params }),
    });
    return res.json();
  }
  async tool(name, args = {}, key) {
    const { result, error } = await this.rpc("tools/call", { name, arguments: args }, key);
    if (error) throw new Error(`${name}: ${error.message}`);
    return { ok: !result.isError, data: result.structuredContent, text: result.content[0].text };
  }
  // The human signs exactly what the agent prepared.
  async sign(prepared) {
    let last;
    for (const s of prepared.steps) {
      const hash = await this.wallet.sendTransaction({ to: s.to, data: s.data, value: 0n });
      last = await pub.waitForTransactionReceipt({ hash });
      if (last.status !== "success") throw new Error(`${this.name}: ${s.function} reverted`);
    }
    return last.transactionHash;
  }
}

const [host, alice, bob] = KEYS.map((k, i) => new Human(k, ["host", "alice", "bob"][i]));

// ---------------------------------------------------------------- humans sign in and create keys
for (const h of [host, alice, bob]) {
  await h.signIn();
  await h.web("/api/world/dev-verify", { method: "POST", json: {} });
  const created = await h.web("/api/keys", { method: "POST", json: { name: `${h.name}'s agent` } });
  h.apiKey = created.data.key;
  check(created.status === 201 && /^aic_/.test(h.apiKey), `${h.name} creates an API key from the site`);
}
const listed = await host.web("/api/keys");
check(listed.data.keys?.length >= 1 && !JSON.stringify(listed.data).includes(host.apiKey), "key list shows the key's prefix, never the key");

const viaKey = await fetch(`${BASE}/api/keys`, { headers: { authorization: `Bearer ${host.apiKey}` } });
check(viaKey.status === 403, "an API key can't list or create keys (403)");
const meViaKey = await (await fetch(`${BASE}/api/me`, { headers: { authorization: `Bearer ${host.apiKey}` } })).json();
check(meViaKey.me?.address === host.account.address && meViaKey.me.via === "key", "plain HTTP with Bearer key: /api/me is the host");

// ---------------------------------------------------------------- MCP protocol
const init = await host.rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } });
check(init.result?.protocolVersion === "2025-06-18" && init.result.serverInfo.name === "ai-city", "MCP initialize negotiates 2025-06-18");
const list = await host.rpc("tools/list", {});
const names = list.result.tools.map((t) => t.name);
check(names.length >= 40 && names.includes("prepare_transaction") && names.includes("launch_city"), `MCP lists ${names.length} tools`);
check(!!(await host.rpc("tools/call", { name: "nope", arguments: {} })).error, "unknown tool is a JSON-RPC error");
const who = await host.tool("whoami");
check(who.data.me?.address === host.account.address && who.data.me.verified, "whoami over MCP: verified host");
const cross = await fetch(`${BASE}/api/mcp`, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });
check(cross.status === 403, "cross-origin browser request to MCP is refused");

// ---------------------------------------------------------------- launch a city (host's agent)
const now = Number((await pub.getBlock()).timestamp);
const day = 86400;
const cityForm = {
  name: "Agent City (e2e)", location: "Kuching, Sarawak",
  mission: "Prove agents can run a pop-up city end to end.",
  description: "Everything in this city was done by agents over MCP, with humans signing.",
  startTime: now + 7 * day, endTime: now + 28 * day,
};
const launched = await host.tool("launch_city", cityForm);
const SLUG = launched.data?.slug;
check(launched.ok && SLUG, `launch_city → ${SLUG}`);
check((await host.tool("add_core_team_member", { slug: SLUG, address: bob.account.address })).ok, "add_core_team_member: bob");
check((await host.tool("get_city", { slug: SLUG })).data.myRole === "founder", "get_city: host is founder");

// ---------------------------------------------------------------- propose, review, deploy
const proposed = await host.tool("propose_residency", {
  citySlug: SLUG, name: "Agent House #1", location: "Kuching", propertyUrl: "",
  mission: "Agents book, humans sign.", description: "A test residency run by agents over MCP.",
  organizers: [{ name: "Host", bio: "", link: "" }],
  rooms: [{ name: "Loft", type: "shared", beds: [{ label: "A", price: "100" }, { label: "B", price: "100" }] }],
  startTime: cityForm.startTime + 1, endTime: cityForm.endTime - 1, deadline: now + 3 * day,
  minSeats: 1, maxSeats: 2, series: { newSeries: { name: "Agent House", description: "" } },
});
const PID = proposed.data?.proposal?.id;
check(proposed.ok && PID, `propose_residency → proposal #${PID}`);
const early = await host.tool("prepare_transaction", { action: "deploy_residency", proposalId: PID });
check(!early.ok && /hasn't approved/.test(early.text), "deploy can't be prepared before approval");
check((await bob.tool("list_city_proposals", { slug: SLUG })).data.proposals?.some((p) => p.id === PID), "bob's agent sees it in list_city_proposals");
check((await bob.tool("review_proposal", { id: PID, decision: "approve", note: "Go" })).data.proposal.status === "approved", "review_proposal: bob approves");

const deployTx = await host.tool("prepare_transaction", { action: "deploy_residency", proposalId: PID });
check(deployTx.ok && deployTx.data.steps.length === 1 && deployTx.data.steps[0].function.startsWith("createResidency("), "prepare deploy_residency → createResidency step");
const deployHash = await host.sign(deployTx.data);
const recorded = await host.tool("record_residency_deploy", { proposalId: PID, txHash: deployHash });
const RES = recorded.data?.address;
check(recorded.ok && RES, `record_residency_deploy → ${RES ?? recorded.text}`);

// ---------------------------------------------------------------- apply, approve, pay
check((await alice.tool("apply_to_residency", { address: RES, name: "Alice", bio: "I build soft robots and run a lab.", preferredBedId: 2 })).ok, "apply_to_residency: alice");
const apps = await host.tool("list_applications", { address: RES });
const APP = apps.data.applications?.[0]?.id;
check(!!APP, "list_applications: host sees alice");
const approveTx = await host.tool("prepare_transaction", { action: "approve_applicant", residency: RES, applicationId: APP });
check(approveTx.ok && approveTx.data.steps[0].args[1] === "2" && approveTx.data.steps[0].args[2] === "100000000", `prepare approve_applicant: preferred bed 2 at 100 USDC ${approveTx.ok ? "" : approveTx.text}`);
const approveHash = await host.sign(approveTx.data);
check((await host.tool("record_application_decision", { address: RES, applicationId: APP, action: "approved", txHash: approveHash })).ok, "record_application_decision: approved");

// Start alice at 0 USDC (earlier local runs leave her some), so the balance check is exercised.
const leftover = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [alice.account.address] });
if (leftover > 0n)
  await alice.wallet.writeContract({ address: USDC, abi: erc20, functionName: "transfer", args: [host.account.address, leftover] }).then((h) => pub.waitForTransactionReceipt({ hash: h }));
const broke = await alice.tool("prepare_transaction", { action: "pay_for_bed", residency: RES });
check(!broke.ok && /You need 100 USDC/.test(broke.text), "pay_for_bed refuses when the wallet lacks USDC");
await host.wallet.writeContract({ address: USDC, abi: erc20, functionName: "mint", args: [alice.account.address, usdc(100)] }).then((h) => pub.waitForTransactionReceipt({ hash: h }));
const payTx = await alice.tool("prepare_transaction", { action: "pay_for_bed", residency: RES });
check(payTx.ok && payTx.data.steps.length === 2 && payTx.data.steps[1].function === "stake(uint256)", "prepare pay_for_bed → USDC approve + stake");
check(payTx.data.page.endsWith(`/r/${RES}`), "pay_for_bed hands off to the residency page");
await alice.sign(payTx.data);
check((await pub.readContract({ address: RES, abi: residencyAbi, functionName: "seatCount" })) === 1, "alice signed the prepared steps: 1 seat staked");
const again = await alice.tool("prepare_transaction", { action: "pay_for_bed", residency: RES });
check(!again.ok && /already paid/.test(again.text), "pay_for_bed refuses a second payment");

// ---------------------------------------------------------------- knowledge
check((await host.tool("write_knowledge_file", { scope: "residency", key: RES, filename: "house-rules.md", content: "# House rules\n\nQuiet hours after 11pm. Durian stays outside." })).ok, "write_knowledge_file (host)");
check(!(await alice.tool("write_knowledge_file", { scope: "residency", key: RES, filename: "x.md", content: "x" })).ok, "a guest can't write the knowledge base");
const hits = await alice.tool("search_knowledge", { q: "durian", residency: RES });
check(hits.data.hits?.length >= 1, "search_knowledge finds the house rules");
check((await alice.tool("read_knowledge_file", { scope: "residency", key: RES, filename: "house-rules.md" })).data.file?.content.includes("Quiet hours"), "read_knowledge_file");

// ---------------------------------------------------------------- deadline, withdraw + receipt, close, claim
await pub.request({ method: "evm_increaseTime", params: [3 * day + 3601] });
await pub.request({ method: "evm_mine", params: [] });
const receipt = Buffer.from("%PDF-1.4\n% AI City agent receipt\n", "utf8");
const withdrawTx = await host.tool("prepare_transaction", {
  action: "withdraw", residency: RES, amount: "40", note: "Groceries", receiptSha256: sha256(toHex(new Uint8Array(receipt))),
});
check(withdrawTx.ok, "prepare withdraw (Active residency)");
const wHash = await host.sign(withdrawTx.data);
const up = await host.tool("upload_receipt", { address: RES, txHash: wHash, filename: "groceries.pdf", mimeType: "application/pdf", base64: receipt.toString("base64") });
check(up.ok, "upload_receipt (base64 over MCP) matches the onchain hash");
check((await alice.tool("list_receipts", { address: RES })).data.receipts?.length === 1, "list_receipts: alice sees it");

await host.sign((await host.tool("prepare_transaction", { action: "close", residency: RES })).data);
const before = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [alice.account.address] });
const claimTx = await alice.tool("prepare_transaction", { action: "claim", residency: RES });
check(claimTx.ok && /Claim 60/.test(claimTx.data.steps[0].summary), "prepare claim: 60 USDC leftover");
await alice.sign(claimTx.data);
const after = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [alice.account.address] });
check(after - before === usdc(60), "alice claimed 60 USDC");

// ---------------------------------------------------------------- profile + directory
check((await alice.tool("update_my_profile", { name: "Alice Agent-Test", bio: "Soft robots.", links: [], listed: true })).ok, "update_my_profile");
check((await bob.tool("search_people", { q: "Agent-Test" })).data.profiles?.some((p) => p.name === "Alice Agent-Test"), "search_people finds her");

// ---------------------------------------------------------------- revoke
const keyId = (await alice.web("/api/keys")).data.keys[0].id;
check((await alice.web(`/api/keys/${keyId}`, { method: "DELETE" })).status === 200, "alice revokes her key from the site");
check((await alice.tool("whoami")).data.me === null, "revoked key: whoami is signed out");
const denied = await alice.tool("list_my_proposals");
check(!denied.ok && /401/.test(denied.text), "revoked key: authed tools fail with 401");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
