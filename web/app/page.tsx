import Link from "next/link";
import { ResidencyGrid } from "@/components/residency-grid";
import { CityGrid } from "@/components/city-card";
import { DirectoryStrip } from "@/components/directory";
import { LinkButton } from "@/components/ui";

// Konrad's mission statement, used exactly as he wrote it.
const MISSION =
  "Accelerate human coordination across cultural bond building and extropian differential acceleration perspective.";

const steps = [
  { n: "1", title: "Verify you're human", body: "Scan once with World ID. One person, one account, 18+." },
  { n: "2", title: "Launch a city or propose a residency", body: "A city is a place and dates. Residencies are proposed inside it and approved by its core team." },
  { n: "3", title: "Stake your bed", body: "Approved guests pay in USDC into the residency's own contract." },
  { n: "4", title: "Fill it or get refunded", body: "Minimum reached by the deadline: the residency goes ahead. If not, everyone is refunded." },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-2">
        <div className="space-y-5">
          <p className="text-sm font-medium text-indigo-600">Our mission</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{MISSION}</h1>
          <p className="max-w-xl text-lg text-muted">
            Pop-up cities are made of residencies. Anyone can propose a residency, each city&apos;s core team decides
            which ones run there, and the money sits in the residency&apos;s own contract until it fills.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="#residencies">Explore residencies</LinkButton>
            <LinkButton href="/launch" variant="secondary">
              Launch
            </LinkButton>
          </div>
        </div>
        <div id="how" className="grid gap-3 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="rounded-2xl border border-line bg-surface p-5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                {s.n}
              </span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="residencies" className="scroll-mt-24 space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Residencies</h2>
          <p className="text-sm text-muted">Open for applications first, soonest deadline first. Then the ones already running.</p>
        </div>
        <ResidencyGrid
          empty={
            <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
              <p className="font-medium">No live residencies yet.</p>
              <p className="mt-1 text-sm text-muted">Pick a city and propose one.</p>
              <LinkButton href="/cities" className="mt-5">
                Browse cities
              </LinkButton>
            </div>
          }
        />
      </section>

      <section id="cities" className="scroll-mt-24 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Pop-up cities</h2>
            <p className="text-sm text-muted">Each city is a place and a time window, run by its core team.</p>
          </div>
          <Link href="/cities/new" className="text-sm font-medium text-indigo-600 hover:underline">
            Launch a city →
          </Link>
        </div>
        <CityGrid
          empty={
            <div className="rounded-2xl border border-dashed border-line bg-surface p-12 text-center">
              <p className="font-medium">No pop-up cities yet.</p>
              <LinkButton href="/cities/new" className="mt-5">
                Launch a city
              </LinkButton>
            </div>
          }
        />
      </section>

      <section className="grid gap-6 rounded-2xl border border-line bg-surface p-6 sm:p-8 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-medium text-indigo-600">New · Argo</p>
          <h2 className="text-2xl font-semibold tracking-tight">Your private journal as a matchmaker</h2>
          <p className="text-muted">
            Link your <a href="https://myargoquest.com" className="underline">Argo</a> private AI journal to your
            profile. Every city and residency has an AI concierge. Press &ldquo;Ask my Argo journal&rdquo; and it sends
            your journal a few questions. You answer or decline each one in Argo, and the concierge introduces you to
            the right people in your residency and your city. Your journal never leaves Argo.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <LinkButton href="/blog/argo-journal-concierge">Read how it works</LinkButton>
            <LinkButton href="/me" variant="secondary">
              Link Argo
            </LinkButton>
          </div>
        </div>
        <ul className="grid gap-3 self-center sm:grid-cols-2">
          {["A new co-founder", "A new business partner", "A new business opportunity", "A trade or a topic to discuss"].map(
            (t) => (
              <li key={t} className="rounded-xl border border-line bg-background px-4 py-3 text-sm font-medium">
                {t}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">People</h2>
            <p className="text-sm text-muted">Everyone who has joined, with the residencies and cities they&apos;ve been part of.</p>
          </div>
          <Link href="/people" className="text-sm font-medium text-indigo-600 hover:underline">
            Open the directory →
          </Link>
        </div>
        <DirectoryStrip />
      </section>
    </div>
  );
}
