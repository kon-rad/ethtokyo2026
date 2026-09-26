import { CityGrid } from "@/components/city-grid";
import { LinkButton } from "@/components/ui";

const steps = [
  { n: "1", title: "Verify you're human", body: "Scan once with World ID. One person, one account, 18+." },
  { n: "2", title: "Launch or apply", body: "Hosts publish a city with rooms and prices. Guests apply with a short intro." },
  { n: "3", title: "Stake your bed", body: "Approved guests pay in USDC into the city's own contract." },
  { n: "4", title: "Fill it or get refunded", body: "Minimum reached by the deadline: the city goes live. If not, everyone is refunded." },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-2">
        <div className="space-y-5">
          <p className="text-sm font-medium text-indigo-600">Pop-up cities, funded together</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Live somewhere new, with people worth meeting.
          </h1>
          <p className="max-w-xl text-lg text-muted">
            AI City is like Luma for pop-up cities. Hosts propose a place and dates, verified humans apply, and the
            money sits in a smart contract until the city fills.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="#explore">Explore cities</LinkButton>
            <LinkButton href="/launch" variant="secondary">
              Launch a city
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

      <section id="explore" className="scroll-mt-24 space-y-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Live cities</h2>
            <p className="text-sm text-muted">Taking applications or already running.</p>
          </div>
        </div>
        <CityGrid />
      </section>
    </div>
  );
}
