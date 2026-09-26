// Seeds a local stack (anvil + DeployLocal + `pnpm dev` with ALLOW_DEV_VERIFY=1) with demo cities
// so the UI has something to show. Uses anvil's test accounts:
//   #0 host — launches every city (import it in MetaMask to use the host dashboard)
//   #1 alice — approved for a bed in the Goa city (import it to try paying)
//   #2 bob — pending application in the Goa city
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
const read = (f, c) => JSON.parse(readFileSync(new URL(`../../contracts/out/${f}/${c}.json`, import.meta.url))).abi;
const factoryAbi = read("AICityFactory.sol", "AICityFactory");
const cityAbi = read("PopupCity.sol", "PopupCity");
const pub = createPublicClient({ chain: anvil, transport: http() });

function user(key) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: anvil, transport: http() });
  const cookies = new Map();
  const call = async (path, body) => {
    const res = await fetch(BASE + path, {
      method: body ? "POST" : "GET",
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

const cities = [
  {
    name: "Builders' House Goa",
    location: "Anjuna, North Goa, India",
    propertyUrl: "https://www.airbnb.com/",
    mission: "Three weeks to ship something real, with people who make things.",
    description:
      "A hacker house in a villa near Anjuna beach during Edge City Goa. Deep work in the mornings, surfing or the market in the afternoons, demos over dinner. Fast fibre, a shared kitchen and a cook three nights a week.\n\nFor founders, engineers and artists who want focus and good company.",
    organizers: [organizer, { name: "Co-host TBD", bio: "", link: "" }],
    rooms: [
      { name: "Garden dorm", type: "shared", beds: [{ label: "Bunk 1", price: "650" }, { label: "Bunk 2", price: "650" }, { label: "Bunk 3", price: "650" }, { label: "Bunk 4", price: "650" }] },
      { name: "Sea-view room", type: "private", beds: [{ label: "King bed", price: "1400" }] },
      { name: "Courtyard room", type: "private", beds: [{ label: "Queen bed", price: "1100" }] },
      { name: "Loft", type: "shared", beds: [{ label: "Twin A", price: "850" }, { label: "Twin B", price: "850" }] },
    ],
    startTime: now + 30 * day,
    endTime: now + 51 * day,
    deadline: now + 14 * day,
    minSeats: 5,
    maxSeats: 8,
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
    startTime: now + 45 * day,
    endTime: now + 75 * day,
    deadline: now + 30 * day,
    minSeats: 3,
    maxSeats: 5,
  },
  {
    name: "Lisbon Network State Week",
    location: "Alfama, Lisbon, Portugal",
    propertyUrl: "",
    mission: "One week to prototype governance for pop-up cities.",
    description: "A short, intense week: talks in the mornings, building in the afternoons, fado at night.",
    organizers: [organizer],
    rooms: [{ name: "Apartment", type: "shared", beds: [{ label: "Bed 1", price: "400" }, { label: "Bed 2", price: "400" }, { label: "Bed 3", price: "400" }, { label: "Bed 4", price: "400" }] }],
    startTime: now + 20 * day,
    endTime: now + 27 * day,
    deadline: now + 10 * day,
    minSeats: 2,
    maxSeats: 4,
  },
];

const created = [];
for (const form of cities) {
  const prep = await host.call("/api/cities/prepare", form);
  const p = prep.params;
  const receipt = await host.tx({
    address: env.NEXT_PUBLIC_FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "createCity",
    args: [{ metadataHash: prep.metadataHash, startTime: BigInt(p.startTime), endTime: BigInt(p.endTime), deadline: BigInt(p.deadline), minSeats: p.minSeats, maxSeats: p.maxSeats }],
  });
  const { address } = await host.call("/api/cities", { txHash: receipt.transactionHash, metadataJson: prep.metadataJson });
  created.push(address);
  console.log(`✓ ${form.name} → ${BASE}/c/${address}`);
}

// Goa: alice approved for the sea-view room (bed id 5), bob pending.
const goa = created[0];
await alice.call(`/api/cities/${goa}/apply`, {
  name: "Alice Tanaka",
  bio: "I build soft robotic grippers and run a small hardware lab in Osaka. Looking for co-founders.",
  links: ["https://x.com/alice", "https://github.com/alice"],
  preferredBedId: 5,
});
await bob.call(`/api/cities/${goa}/apply`, {
  name: "Bob Okafor",
  bio: "Zero-knowledge researcher. Will bring a guitar and cook jollof rice.",
  links: ["https://bob.dev"],
  preferredBedId: 1,
});
const { applications } = await host.call(`/api/cities/${goa}/applications`);
const aliceApp = applications.find((a) => a.applicant === alice.account.address.toLowerCase());
const approve = await host.tx({ address: goa, abi: cityAbi, functionName: "approve", args: [alice.account.address, 5, 1_400_000_000n] });
await host.call(`/api/cities/${goa}/applications/${aliceApp.id}`, { action: "approved", txHash: approve.transactionHash });
console.log("✓ Goa: alice approved for the sea-view room (1,400 USDC), bob pending");
