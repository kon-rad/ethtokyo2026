// Seeds a local stack (anvil + DeployLocal + `pnpm dev` with ALLOW_DEV_VERIFY=1) with demo cities
// and residencies so the UI has something to show. Uses anvil's test accounts:
//   #0 host — launches the city, proposes residencies (import it in MetaMask to use the host dashboard)
//   #1 alice — approved for a bed in the Goa residency
//   #2 bob — pending application
//   node scripts/seed-local.mjs [baseUrl]
import { createPublicClient, createWalletClient, http } from "viem";
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
const readAbi = (f, c) => JSON.parse(readFileSync(new URL(`../../contracts/out/${f}/${c}.json`, import.meta.url))).abi;
const factoryAbi = readAbi("ResidencyFactory.sol", "ResidencyFactory");
const residencyAbi = readAbi("Residency.sol", "Residency");
const pub = createPublicClient({ chain: anvil, transport: http() });

function user(key) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: anvil, transport: http() });
  const cookies = new Map();
  // call(path) → GET; call(path, body) → POST body; call(path, { method, json }) → that method + json.
  const call = async (path, arg) => {
    const explicit = arg && typeof arg === "object" && "method" in arg && "json" in arg;
    const body = explicit ? arg.json : arg;
    const res = await fetch(BASE + path, {
      method: explicit ? arg.method : body ? "POST" : "GET",
      headers: { "content-type": "application/json", cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [k, v] = c.split(";")[0].split("=");
      if (v) cookies.set(k, v);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path}: ${data.error ?? res.status}`);
    return data;
  };
  const signIn = async () => {
    const { nonce } = await call("/api/auth/nonce");
    const message = createSiweMessage({
      domain: new URL(BASE).host, address: account.address, statement: "Sign in to AI City.",
      uri: BASE, version: "1", chainId: anvil.id, nonce,
    });
    await call("/api/auth/verify", { message, signature: await wallet.signMessage({ message }) });
    await call("/api/world/dev-verify", {});
  };
  const tx = async (req) => pub.waitForTransactionReceipt({ hash: await wallet.writeContract(req) });
  return { account, call, signIn, tx };
}

const host = user("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const alice = user("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = user("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
for (const u of [host, alice, bob]) await u.signIn();

const now = Number((await pub.getBlock()).timestamp);
const day = 86400;
const organizer = { name: "Konrad Gnat", bio: "Builder, Argo founder, runs AI Power Users classes.", link: "https://x.com/konradgnat" };

// --------------------------------------------------------------------- launch a city
const city = await host.call("/api/cities", {
  method: "POST",
  json: {
    name: "Edge City Goa",
    location: "Anjuna, North Goa, India",
    mission: "Three weeks to ship something real, with people who make things.",
    description: "A pop-up city for founders, engineers and artists who want focus and good company. Deep work in the mornings, surfing or the market in the afternoons, demos over dinner.",
    startTime: now + 30 * day,
    endTime: now + 51 * day,
  },
});
console.log(`\u2713 City launched: ${BASE}/cities/${city.slug}`);

// --------------------------------------------------------------------- add core team
await host.call(`/api/cities/${city.slug}/team`, { address: alice.account.address });
console.log("\u2713 Alice added to core team");

// --------------------------------------------------------------------- propose residencies
const residencyForms = [
  {
    name: "Builders' House Goa",
    location: "Anjuna, North Goa, India",
    propertyUrl: "https://www.airbnb.com/",
    mission: "Three weeks to ship something real, with people who make things.",
    description: "A hacker house in a villa near Anjuna beach during Edge City Goa. Deep work in the mornings, surfing or the market in the afternoons, demos over dinner. Fast fibre, a shared kitchen and a cook three nights a week.",
    organizers: [organizer, { name: "Co-host TBD", bio: "", link: "" }],
    rooms: [
      { name: "Garden dorm", type: "shared", beds: [{ label: "Bunk 1", price: "650" }, { label: "Bunk 2", price: "650" }, { label: "Bunk 3", price: "650" }, { label: "Bunk 4", price: "650" }] },
      { name: "Sea-view room", type: "private", beds: [{ label: "King bed", price: "1400" }] },
      { name: "Courtyard room", type: "private", beds: [{ label: "Queen bed", price: "1100" }] },
      { name: "Loft", type: "shared", beds: [{ label: "Twin A", price: "850" }, { label: "Twin B", price: "850" }] },
    ],
    startTime: now + 30 * day + 1,
    endTime: now + 51 * day - 1,
    deadline: now + 14 * day,
    minSeats: 5,
    maxSeats: 8,
    series: { newSeries: { name: "Builders' House", description: "A recurring builder residency at Edge City" } },
  },
  {
    name: "Chiang Mai AI Residency",
    location: "Nimman, Chiang Mai, Thailand",
    propertyUrl: "",
    mission: "A month of building agents in a calm, cheap, green city.",
    description: "Co-living in a converted guesthouse with a coworking floor. Weekly show-and-tell, Muay Thai mornings, and a shared GPU budget.",
    organizers: [organizer],
    rooms: [
      { name: "Private rooms", type: "private", beds: [{ label: "Room 1", price: "900" }, { label: "Room 2", price: "900" }, { label: "Room 3", price: "900" }] },
      { name: "Shared room", type: "shared", beds: [{ label: "Bed A", price: "550" }, { label: "Bed B", price: "550" }] },
    ],
    startTime: now + 31 * day,
    endTime: now + 50 * day,
    deadline: now + 20 * day,
    minSeats: 3,
    maxSeats: 5,
    series: { newSeries: { name: "AI Residency", description: "Building agents in great cities" } },
  },
  {
    name: "Lisbon Network State Week",
    location: "Alfama, Lisbon, Portugal",
    propertyUrl: "",
    mission: "One week to prototype governance for pop-up cities.",
    description: "A short, intense week: talks in the mornings, building in the afternoons, fado at night.",
    organizers: [organizer],
    rooms: [{ name: "Apartment", type: "shared", beds: [{ label: "Bed 1", price: "400" }, { label: "Bed 2", price: "400" }, { label: "Bed 3", price: "400" }, { label: "Bed 4", price: "400" }] }],
    startTime: now + 33 * day,
    endTime: now + 40 * day,
    deadline: now + 18 * day,
    minSeats: 2,
    maxSeats: 4,
    series: { newSeries: { name: "Network State Week", description: "Short, intense pop-up governance" } },
  },
];

const proposals = [];
for (const form of residencyForms) {
  const { proposal } = await host.call(`/api/cities/${city.slug}/proposals`, form);
  proposals.push(proposal);
  console.log(`\u2713 ${form.name} proposed -> /proposals/${proposal.id}`);
}

// --------------------------------------------------------------------- approve the first proposal + deploy it
const approve = await host.call(`/api/proposals/${proposals[0].id}`, { decision: "approve", note: "Let's go!" });
const receipt = await host.tx({
  address: env.NEXT_PUBLIC_FACTORY_ADDRESS,
  abi: factoryAbi,
  functionName: "createResidency",
  args: [{
    metadataHash: approve.proposal.metadataHash,
    startTime: BigInt(approve.proposal.params.startTime),
    endTime: BigInt(approve.proposal.params.endTime),
    deadline: BigInt(approve.proposal.params.deadline),
    minSeats: approve.proposal.params.minSeats,
    maxSeats: approve.proposal.params.maxSeats,
  }],
});
const { address: residencyAddr } = await host.call("/api/residencies", {
  method: "POST",
  json: { txHash: receipt.transactionHash, proposalId: proposals[0].id },
});
console.log(`\u2713 Builders' House Goa deployed -> ${BASE}/r/${residencyAddr}`);

// --------------------------------------------------------------------- alice applies, host approves
await alice.call(`/api/residencies/${residencyAddr}/apply`, {
  name: "Alice Tanaka",
  bio: "I build soft robotic grippers and run a small hardware lab in Osaka. Looking for co-founders.",
  links: ["https://x.com/alice", "https://github.com/alice"],
  preferredBedId: 5,
});
await bob.call(`/api/residencies/${residencyAddr}/apply`, {
  name: "Bob Okafor",
  bio: "Zero-knowledge researcher. Will bring a guitar and cook jollof rice.",
  links: ["https://bob.dev"],
  preferredBedId: 1,
});
const { applications } = await host.call(`/api/residencies/${residencyAddr}/applications`);
const aliceApp = applications.find((a) => a.applicant === alice.account.address.toLowerCase());
const approveTx = await host.tx({ address: residencyAddr, abi: residencyAbi, functionName: "approve", args: [alice.account.address, 5, 1_400_000_000n] });
await host.call(`/api/residencies/${residencyAddr}/applications/${aliceApp.id}`, { action: "approved", txHash: approveTx.transactionHash });
console.log("\u2713 Alice approved for the sea-view room (1,400 USDC), bob pending");

// --------------------------------------------------------------------- create profiles
for (const [u, name, bio] of [
  [host, "Konrad Gnat", "Founder of Argo. Building AI City."],
  [alice, "Alice Tanaka", "Soft robotics engineer. Hardware lab in Osaka."],
  [bob, "Bob Okafor", "ZK researcher. Brings a guitar."],
]) {
  await u.call("/api/profiles/me", { method: "PUT", json: { name, bio, links: [], listed: true } });
}
console.log("\u2713 Profiles created for host, alice and bob");

console.log(`\nDone. Open ${BASE}/cities/${city.slug} in the browser.`);