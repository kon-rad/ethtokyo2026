// End-to-end test against a local stack: anvil + DeployLocal + Postgres + `pnpm dev` with
// ALLOW_DEV_VERIFY=1. Drives the real API and real contracts with anvil's test accounts.
//   node scripts/e2e-local.mjs [baseUrl]
import { createPublicClient, createWalletClient, http, parseUnits, sha256, toHex, parseAbi } from "viem";
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
const FACTORY = env.NEXT_PUBLIC_FACTORY_ADDRESS;
const USDC = env.NEXT_PUBLIC_USDC_ADDRESS;
const KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

const abi = JSON.parse(readFileSync(new URL("../../contracts/out/PopupCity.sol/PopupCity.json", import.meta.url))).abi;
const factoryAbi = JSON.parse(readFileSync(new URL("../../contracts/out/AICityFactory.sol/AICityFactory.json", import.meta.url))).abi;
const erc20 = parseAbi(["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);

const pub = createPublicClient({ chain: anvil, transport: http() });
const usdc = (n) => parseUnits(String(n), 6);
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) failures++;
};

class User {
  constructor(key, name) {
    this.name = name;
    this.account = privateKeyToAccount(key);
    this.wallet = createWalletClient({ account: this.account, chain: anvil, transport: http() });
    this.cookies = new Map();
  }
  async fetch(path, init = {}) {
    const headers = new Headers(init.headers);
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      if (v) this.cookies.set(k, v);
      else this.cookies.delete(k);
    }
    return res;
  }
  async json(path, body, method = body ? "POST" : "GET") {
    const res = await this.fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
  async signIn() {
    const { data } = await this.json("/api/auth/nonce");
    const message = createSiweMessage({
      domain: new URL(BASE).host,
      address: this.account.address,
      statement: "Sign in to AI City.",
      uri: BASE,
      version: "1",
      chainId: anvil.id,
      nonce: data.nonce,
    });
    const signature = await this.wallet.signMessage({ message });
    return this.json("/api/auth/verify", { message, signature });
  }
  async tx(req) {
    const hash = await this.wallet.writeContract(req);
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`${this.name}: ${req.functionName} reverted`);
    return r;
  }
}

const [host, alice, bob, stranger] = KEYS.map((k, i) => new User(k, ["host", "alice", "bob", "stranger"][i]));

// ---------------------------------------------------------------- sign in + verify
for (const u of [host, alice, bob, stranger]) {
  const r = await u.signIn();
  check(r.status === 200 && r.data.me?.address === u.account.address, `${u.name} signs in with SIWE`);
}
const unverified = await stranger.json("/api/cities/prepare", {});
check(unverified.status === 403, "unverified wallet can't prepare a city (403)");
for (const u of [host, alice, bob]) {
  const r = await u.json("/api/world/dev-verify", {});
  check(r.data.me?.verified && r.data.me?.adult, `${u.name} verified (dev path)`);
}

// ---------------------------------------------------------------- launch
const block = await pub.getBlock();
const now = Number(block.timestamp);
const form = {
  name: "Builders' House Goa (e2e)",
  location: "Anjuna, Goa, India",
  propertyUrl: "https://example.com/villa",
  mission: "Ship something real in three weeks with good people.",
  description: "Mornings deep work, afternoons swimming, evenings demos. Shared kitchen and fast wifi.",
  organizers: [{ name: "Konrad", bio: "Builder", link: "https://x.com/konradgnat" }, { name: "Co-host", bio: "", link: "" }],
  rooms: [
    { name: "Garden room", type: "shared", beds: [{ label: "Bunk A", price: "100" }, { label: "Bunk B", price: "100" }] },
    { name: "Sea view", type: "private", beds: [{ label: "Queen", price: "200" }] },
  ],
  startTime: now + 7200,
  endTime: now + 7200 + 8 * 86400,
  deadline: now + 3600,
  minSeats: 2,
  maxSeats: 3,
};
const bad = await host.json("/api/cities/prepare", { ...form, endTime: form.startTime + 86400 });
check(bad.status === 400 && /week/.test(bad.data.error), `prepare rejects a 1-day city: "${bad.data.error}"`);

const prep = await host.json("/api/cities/prepare", form);
check(prep.status === 200 && prep.data.metadataHash?.startsWith("0x"), "prepare returns canonical metadata + hash");
const p = prep.data.params;
const createReceipt = await host.tx({
  address: FACTORY,
  abi: factoryAbi,
  functionName: "createCity",
  args: [{ metadataHash: prep.data.metadataHash, startTime: BigInt(p.startTime), endTime: BigInt(p.endTime), deadline: BigInt(p.deadline), minSeats: p.minSeats, maxSeats: p.maxSeats }],
});
const tampered = await host.json("/api/cities", { txHash: createReceipt.transactionHash, metadataJson: prep.data.metadataJson.replace("Goa", "Bali") });
check(tampered.status === 400, "register rejects metadata that doesn't match the onchain hash");
const stolen = await alice.json("/api/cities", { txHash: createReceipt.transactionHash, metadataJson: prep.data.metadataJson });
check(stolen.status === 403, "another wallet can't register the host's city");
const reg = await host.json("/api/cities", { txHash: createReceipt.transactionHash, metadataJson: prep.data.metadataJson });
check(reg.status === 200, `city registered at ${reg.data.address}`);
const CITY = reg.data.address;

const list = await stranger.json("/api/cities?cursor=0");
const listed = list.data.cities?.find((c) => c.address.toLowerCase() === CITY.toLowerCase());
check(!!listed && listed.state?.status === "Open", "city appears in the listing with status Open");

// ---------------------------------------------------------------- apply + review
const noVerifyApply = await stranger.json(`/api/cities/${CITY}/apply`, { name: "S", bio: "x".repeat(30), links: [], preferredBedId: null });
check(noVerifyApply.status === 403, "unverified stranger can't apply (403)");
const hostApply = await host.json(`/api/cities/${CITY}/apply`, { name: "Host", bio: "x".repeat(30), links: [], preferredBedId: 1 });
check(hostApply.status === 400, "host can't apply to own city");
const aApp = await alice.json(`/api/cities/${CITY}/apply`, { name: "Alice", bio: "I build soft robots and run a hardware lab.", links: ["https://x.com/alice"], preferredBedId: 1 });
const bApp = await bob.json(`/api/cities/${CITY}/apply`, { name: "Bob", bio: "Zero-knowledge researcher, brings a guitar.", links: [], preferredBedId: 3 });
check(aApp.status === 200 && bApp.status === 200, "alice and bob apply");

const notHost = await alice.json(`/api/cities/${CITY}/applications`);
check(notHost.status === 403, "non-host can't list applications");
const apps = await host.json(`/api/cities/${CITY}/applications`);
check(apps.data.applications?.length === 2 && apps.data.applications.every((a) => a.verified_human), "host sees 2 verified applications");
const appOf = (u) => apps.data.applications.find((a) => a.applicant === u.account.address.toLowerCase());

for (const [u, bed, price] of [[alice, 1, 100], [bob, 3, 200]]) {
  const r = await host.tx({ address: CITY, abi, functionName: "approve", args: [u.account.address, bed, usdc(price)] });
  const rec = await host.json(`/api/cities/${CITY}/applications/${appOf(u).id}`, { action: "approved", txHash: r.transactionHash });
  check(rec.status === 200, `${u.name} approved onchain for bed ${bed} at ${price} USDC and recorded`);
}
const doubleBook = await host.wallet
  .writeContract({ address: CITY, abi, functionName: "approve", args: [stranger.account.address, 1, usdc(100)] })
  .then(() => false)
  .catch(() => true);
check(doubleBook, "bed 1 can't be double-booked");

// ---------------------------------------------------------------- stake
for (const [u, price] of [[alice, 100], [bob, 200]]) {
  await host.tx({ address: USDC, abi: parseAbi(["function mint(address,uint256)"]), functionName: "mint", args: [u.account.address, usdc(price)] });
  await u.tx({ address: USDC, abi: erc20, functionName: "approve", args: [CITY, usdc(price)] });
  await u.tx({ address: CITY, abi, functionName: "stake" });
}
check((await pub.readContract({ address: CITY, abi, functionName: "seatCount" })) === 2n, "2 seats staked");

const earlyReceipts = await stranger.json(`/api/cities/${CITY}/receipts`);
check(earlyReceipts.status === 403, "non-member can't see receipts");

// ---------------------------------------------------------------- deadline → Active
await pub.request({ method: "evm_increaseTime", params: [3601] });
await pub.request({ method: "evm_mine", params: [] });
check((await pub.readContract({ address: CITY, abi, functionName: "status" })) === 1, "status is Active after the deadline");

// ---------------------------------------------------------------- withdraw + receipt
const file = Buffer.from("%PDF-1.4\n% AI City test receipt\n", "utf8");
const receiptHash = sha256(toHex(new Uint8Array(file)));
const wr = await host.tx({ address: CITY, abi, functionName: "withdraw", args: [usdc(150), receiptHash, "Villa deposit"] });
const wrongFile = new FormData();
wrongFile.set("file", new Blob([Buffer.from("%PDF-1.4 other")], { type: "application/pdf" }), "wrong.pdf");
wrongFile.set("txHash", wr.transactionHash);
check((await host.fetch(`/api/cities/${CITY}/receipts`, { method: "POST", body: wrongFile })).status === 400, "upload rejects a file whose hash doesn't match");
const htmlFile = new FormData();
htmlFile.set("file", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "x.html");
htmlFile.set("txHash", wr.transactionHash);
check((await host.fetch(`/api/cities/${CITY}/receipts`, { method: "POST", body: htmlFile })).status === 400, "upload rejects HTML files");
const fd = new FormData();
fd.set("file", new Blob([file], { type: "application/pdf" }), "villa-deposit.pdf");
fd.set("txHash", wr.transactionHash);
const up = await host.fetch(`/api/cities/${CITY}/receipts`, { method: "POST", body: fd });
check(up.status === 200, "host uploads the matching receipt");

const rl = await alice.json(`/api/cities/${CITY}/receipts`);
check(rl.data.receipts?.length === 1, "member alice sees the receipt");
const dl = await alice.fetch(`/api/cities/${CITY}/receipts/${rl.data.receipts[0].id}`);
const bytes = Buffer.from(await dl.arrayBuffer());
check(dl.status === 200 && bytes.equals(file), "alice downloads the exact receipt file");

// ---------------------------------------------------------------- close + claim
await host.tx({ address: CITY, abi, functionName: "close" });
const before = await Promise.all([alice, bob].map((u) => pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [u.account.address] })));
await alice.tx({ address: CITY, abi, functionName: "claim" });
await bob.tx({ address: CITY, abi, functionName: "claim" });
const after = await Promise.all([alice, bob].map((u) => pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [u.account.address] })));
check(after[0] - before[0] === usdc(50) && after[1] - before[1] === usdc(100), "leftovers pro-rata: alice 50, bob 100 USDC");

// ---------------------------------------------------------------- pages render
for (const path of ["/", `/c/${CITY}`, "/launch", "/verify", `/c/${CITY}/apply`, `/c/${CITY}/manage`]) {
  const r = await fetch(BASE + path);
  check(r.status === 200, `GET ${path} → ${r.status}`);
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);
