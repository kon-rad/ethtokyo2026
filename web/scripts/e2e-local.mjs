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

const abi = JSON.parse(readFileSync(new URL("../../contracts/out/Residency.sol/Residency.json", import.meta.url))).abi;
const factoryAbi = JSON.parse(readFileSync(new URL("../../contracts/out/ResidencyFactory.sol/ResidencyFactory.json", import.meta.url))).abi;
const erc20 = parseAbi(["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);

const pub = createPublicClient({ chain: anvil, transport: http() });
const usdc = (n) => parseUnits(String(n), 6);
let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "\u2713" : "\u2717"} ${msg}`);
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
  // json(path) → GET; json(path, body) → POST body; json(path, { method, json }) → that method + json.
  async json(path, arg, method) {
    const explicit = arg && typeof arg === "object" && "method" in arg && "json" in arg;
    const body = explicit ? arg.json : arg;
    method = explicit ? arg.method : (method ?? (body ? "POST" : "GET"));
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
const unverified = await stranger.json("/api/cities", { method: "POST", json: { name: "x", location: "x", mission: "x".repeat(20), description: "x".repeat(20), startTime: 1, endTime: 2 } });
check(unverified.status === 403, "unverified wallet can't launch a city (403)");
for (const u of [host, alice, bob]) {
  const r = await u.json("/api/world/dev-verify", {});
  check(r.data.me?.verified && r.data.me?.adult, `${u.name} verified (dev path)`);
}

// ---------------------------------------------------------------- launch a city (offchain)
const block = await pub.getBlock();
const now = Number(block.timestamp);
const day = 86400;

const cityForm = {
  name: "Edge City Goa (e2e)",
  location: "Anjuna, Goa, India",
  mission: "Ship something real in three weeks with good people.",
  description: "Mornings deep work, afternoons swimming, evenings demos. Shared kitchen and fast wifi.",
  startTime: now + 7 * day,
  endTime: now + 28 * day,
};
const cityRes = await host.json("/api/cities", { method: "POST", json: cityForm });
check(cityRes.status === 200 && cityRes.data.slug, `city launched with slug: ${cityRes.data.slug}`);
const CITY_SLUG = cityRes.data.slug;

const cityGet = await host.json(`/api/cities/${CITY_SLUG}`);
check(cityGet.status === 200 && cityGet.data.city.slug === CITY_SLUG, "city appears by slug");
check(cityGet.data.myRole === "founder", "founder sees their role");

// ---------------------------------------------------------------- core team
const teamAdd = await host.json(`/api/cities/${CITY_SLUG}/team`, { address: alice.account.address });
check(teamAdd.status === 200 && teamAdd.data.coreTeam.length === 2, "founder adds alice to core team");

const aliceCity = await alice.json(`/api/cities/${CITY_SLUG}`);
check(aliceCity.data.myRole === "core", "alice sees her core role");

// ---------------------------------------------------------------- propose a residency
const residencyForm = {
  name: "Builders' House Goa #1",
  location: "Anjuna, Goa, India",
  propertyUrl: "https://example.com/villa",
  mission: "Ship something real.",
  description: "Three weeks of building.",
  organizers: [{ name: "Konrad", bio: "Builder", link: "https://x.com/konradgnat" }],
  rooms: [
    { name: "Garden room", type: "shared", beds: [{ label: "Bunk A", price: "100" }, { label: "Bunk B", price: "100" }] },
    { name: "Sea view", type: "private", beds: [{ label: "Queen", price: "200" }] },
  ],
  startTime: cityForm.startTime + 1,
  endTime: cityForm.endTime - 1,
  deadline: now + 3 * day,
  minSeats: 1,
  maxSeats: 3,
  series: { newSeries: { name: "Builders' House", description: "A recurring builder residency" } },
};
const propRes = await host.json(`/api/cities/${CITY_SLUG}/proposals`, residencyForm);
check(propRes.status === 200 && propRes.data.proposal.id, `proposal created: #${propRes.data.proposal.id}`);
const PROP_ID = propRes.data.proposal.id;

// stranger can't see the proposal
const strangerProp = await stranger.json(`/api/proposals/${PROP_ID}`);
check(strangerProp.status === 403, "stranger can't see the proposal (403)");

// core team can see and approve
const aliceProp = await alice.json(`/api/proposals/${PROP_ID}`);
check(aliceProp.status === 200 && aliceProp.data.proposal.status === "proposed", "alice (core) sees the proposal");

const approve = await alice.json(`/api/proposals/${PROP_ID}`, { decision: "approve", note: "Looks good!" });
check(approve.status === 200 && approve.data.proposal.status === "approved", "alice approves the proposal");

// ---------------------------------------------------------------- deploy
const deployHash = await host.tx({
  address: FACTORY,
  abi: factoryAbi,
  functionName: "createResidency",
  args: [{
    metadataHash: approve.data.proposal.metadataHash,
    startTime: BigInt(approve.data.proposal.params.startTime),
    endTime: BigInt(approve.data.proposal.params.endTime),
    deadline: BigInt(approve.data.proposal.params.deadline),
    minSeats: approve.data.proposal.params.minSeats,
    maxSeats: approve.data.proposal.params.maxSeats,
  }],
});
const deploy = await host.json("/api/residencies", {
  method: "POST",
  json: { txHash: deployHash.transactionHash, proposalId: PROP_ID },
});
check(deploy.status === 200 && deploy.data.address, `residency deployed at ${deploy.data.address}`);
const RES_ADDR = deploy.data.address;

const propAfter = await host.json(`/api/proposals/${PROP_ID}`);
check(propAfter.data.proposal.status === "deployed", "proposal marked as deployed");

// ---------------------------------------------------------------- the residency listing
const listing = await stranger.json("/api/residencies?cursor=0");
check(listing.data.residencies?.length > 0, "residency appears in listing");

const resDetail = await stranger.json(`/api/residencies/${RES_ADDR}`);
check(resDetail.status === 200 && resDetail.data.residency.city?.slug === CITY_SLUG, "residency detail shows its city");

// ---------------------------------------------------------------- apply + review (same flow as before)
const aApp = await alice.json(`/api/residencies/${RES_ADDR}/apply`, {
  name: "Alice Tanaka",
  bio: "I build soft robots and run a hardware lab.",
  links: ["https://x.com/alice"],
  preferredBedId: null,
});
check(aApp.status === 200, "alice applies");

const apps = await host.json(`/api/residencies/${RES_ADDR}/applications`);
check(apps.data.applications?.length === 1 && apps.data.applications[0].verified_human, "host sees 1 verified application");

const appId = apps.data.applications[0].id;
const approveOnchain = await host.tx({ address: RES_ADDR, abi, functionName: "approve", args: [alice.account.address, 1, usdc(100)] });
const rec = await host.json(`/api/residencies/${RES_ADDR}/applications/${appId}`, { action: "approved", txHash: approveOnchain.transactionHash });
check(rec.status === 200, "alice approved onchain and recorded");

// ---------------------------------------------------------------- stake
await host.tx({ address: USDC, abi: parseAbi(["function mint(address,uint256)"]), functionName: "mint", args: [alice.account.address, usdc(100)] });
await alice.tx({ address: USDC, abi: erc20, functionName: "approve", args: [RES_ADDR, usdc(100)] });
const wrongPrice = await alice.tx({ address: RES_ADDR, abi, functionName: "stake", args: [usdc(99)] }).then(() => false, (e) => /PriceChanged/.test(String(e)));
check(wrongPrice, "stake with a price other than the approved one reverts (PriceChanged)");
await alice.tx({ address: RES_ADDR, abi, functionName: "stake", args: [usdc(100)] });
check((await pub.readContract({ address: RES_ADDR, abi, functionName: "seatCount" })) === 1n, "1 seat staked");

// ---------------------------------------------------------------- deadline -> Active
await pub.request({ method: "evm_increaseTime", params: [3 * day + 3601] });
await pub.request({ method: "evm_mine", params: [] });
check((await pub.readContract({ address: RES_ADDR, abi, functionName: "status" })) === 1, "status is Active after the deadline");

// ---------------------------------------------------------------- withdraw + receipt
const file = Buffer.from("%PDF-1.4\n% AI City test receipt\n", "utf8");
const receiptHash = sha256(toHex(new Uint8Array(file)));
const wr = await host.tx({ address: RES_ADDR, abi, functionName: "withdraw", args: [usdc(50), receiptHash, "Villa deposit"] });
const fd = new FormData();
fd.set("file", new Blob([file], { type: "application/pdf" }), "villa-deposit.pdf");
fd.set("txHash", wr.transactionHash);
const up = await host.fetch(`/api/residencies/${RES_ADDR}/receipts`, { method: "POST", body: fd });
check(up.status === 200, "host uploads the matching receipt");

const rl = await alice.json(`/api/residencies/${RES_ADDR}/receipts`);
check(rl.data.receipts?.length === 1, "member alice sees the receipt");

// ---------------------------------------------------------------- close + claim
await host.tx({ address: RES_ADDR, abi, functionName: "close" });
const before = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [alice.account.address] });
await alice.tx({ address: RES_ADDR, abi, functionName: "claim" });
const after = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [alice.account.address] });
check(after - before === usdc(50), "alice claims pro-rata leftovers (50 USDC)");

// ---------------------------------------------------------------- host handover
await host.tx({ address: RES_ADDR, abi, functionName: "transferHost", args: [bob.account.address] });
check((await pub.readContract({ address: RES_ADDR, abi, functionName: "pendingHost" })) === bob.account.address, "host offers the role to bob");
await bob.tx({ address: RES_ADDR, abi, functionName: "acceptHost" });
const synced = await stranger.json(`/api/residencies/${RES_ADDR}/host`, {});
check(synced.status === 200 && synced.data.host === bob.account.address, "host sync reads bob from the chain");
const afterSync = await stranger.json(`/api/residencies/${RES_ADDR}`);
check(afterSync.data.residency?.host.toLowerCase() === bob.account.address.toLowerCase(), "residency record now names bob as host");
check((await host.json(`/api/residencies/${RES_ADDR}/applications`)).status === 403, "old host loses the host dashboard");

// ---------------------------------------------------------------- pages render
const paths = [
  "/", `/cities`, `/cities/${CITY_SLUG}`, `/cities/${CITY_SLUG}/manage`, `/cities/${CITY_SLUG}/propose`,
  `/launch`, `/verify`, `/proposals/${PROP_ID}`, `/series/builders-house`,
  `/r/${RES_ADDR}`, `/r/${RES_ADDR}/manage`, `/r/${RES_ADDR}/apply`,
  `/people`, `/people/${alice.account.address}`, `/me`, `/docs`, `/docs/contracts`,
];
for (const path of paths) {
  const r = await fetch(BASE + path);
  check(r.status === 200, `GET ${path} \u2192 ${r.status}`);
}

// ---------------------------------------------------------------- profile
const profileSet = await host.json("/api/profiles/me", { method: "PUT", json: { name: "Host Person", bio: "Building cities.", links: [], listed: true } });
check(profileSet.status === 200 && profileSet.data.profile.name === "Host Person", "profile created");

const dir = await stranger.json("/api/directory?cursor=0");
check(dir.data.profiles?.some((p) => p.name === "Host Person"), "profile appears in directory");

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures ? 1 : 0);