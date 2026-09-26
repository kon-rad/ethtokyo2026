/**
 * Pop-up city calendar. Dummy data for now: there's no events table yet, so
 * every city shows the same sample week, dated relative to today so it never
 * goes stale. Replace with a real query when city events land in Postgres.
 */

export type CityEvent = {
  id: string;
  title: string;
  /** Unix seconds */
  start: number;
  durationMin: number;
  place: string;
  kind: "talk" | "workshop" | "meal" | "social" | "build";
};

const SAMPLE: { day: number; hour: number; min: number; durationMin: number; title: string; place: string; kind: CityEvent["kind"] }[] = [
  { day: 0, hour: 8, min: 0, durationMin: 60, title: "Morning run + swim", place: "Beach gate", kind: "social" },
  { day: 0, hour: 10, min: 30, durationMin: 90, title: "Opening circle", place: "Main hall", kind: "talk" },
  { day: 0, hour: 19, min: 0, durationMin: 120, title: "Welcome dinner", place: "Courtyard", kind: "meal" },
  { day: 1, hour: 11, min: 0, durationMin: 120, title: "Build a seat-key door", place: "Hardware lab", kind: "workshop" },
  { day: 1, hour: 15, min: 0, durationMin: 60, title: "d/acc in practice", place: "Main hall", kind: "talk" },
  { day: 2, hour: 10, min: 0, durationMin: 180, title: "Hack block: agents", place: "Co-working", kind: "build" },
  { day: 2, hour: 20, min: 0, durationMin: 90, title: "Demo night", place: "Rooftop", kind: "social" },
  { day: 3, hour: 9, min: 30, durationMin: 60, title: "Residency hosts sync", place: "Room 2", kind: "talk" },
];

export function sampleCityEvents(slug: string, now = Date.now()): CityEvent[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return SAMPLE.map((e, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + e.day);
    d.setHours(e.hour, e.min, 0, 0);
    return {
      id: `${slug}-${i}`,
      title: e.title,
      start: Math.floor(d.getTime() / 1000),
      durationMin: e.durationMin,
      place: e.place,
      kind: e.kind,
    };
  });
}

/** Events that haven't ended yet, soonest first. */
export function upcoming(events: CityEvent[], now = Date.now()): CityEvent[] {
  const t = now / 1000;
  return events.filter((e) => e.start + e.durationMin * 60 > t).sort((a, b) => a.start - b.start);
}
