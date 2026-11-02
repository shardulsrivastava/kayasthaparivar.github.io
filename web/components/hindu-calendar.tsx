"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getMonth, todayInIndia, type Panchang } from "@/lib/panchang";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORIES = {
  tithi: { label: "Tithi", className: "bg-muted text-foreground", dot: "bg-muted-foreground" },
  festival: { label: "Festival", className: "bg-orange-950 text-orange-300", dot: "bg-orange-400" },
  vrat: { label: "Ekadashi / vrat", className: "bg-emerald-950 text-emerald-300", dot: "bg-emerald-400" },
  purnima: { label: "Purnima", className: "bg-sky-950 text-sky-300", dot: "bg-sky-400" },
  amavasya: { label: "Amavasya", className: "bg-violet-950 text-violet-300", dot: "bg-violet-400" },
};
type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];

const FESTIVAL_NOTES: Record<string, string> = {
  "Vasant Panchami": "Worship of Goddess Saraswati; marks the arrival of spring.",
  "Maha Shivaratri": "Night-long worship of Lord Shiva on Phalguna Krishna Chaturdashi.",
  Holi: "Festival of colours, the day after Holika Dahan.",
  "Ram Navami": "Birth of Lord Rama, celebrated at midday.",
  "Raksha Bandhan": "Sisters tie rakhi on their brothers' wrists on Shravana Purnima.",
  Janmashtami: "Birth of Lord Krishna, celebrated at midnight.",
  Dussehra: "Victory of Lord Rama over Ravana; Vijayadashami.",
  Diwali: "Lakshmi Puja on Kartik Amavasya, the festival of lights.",
  "Govardhan Puja": "Annakut offering, the day after Diwali.",
  "Chitragupta Puja · Bhai Dooj":
    "Kalam-dawat puja of Shri Chitragupta, the Kayastha kuldevta; sisters honour brothers on Bhai Dooj.",
  "Chhath Puja": "Worship of Surya and Chhathi Maiya with offerings at sunset.",
  "Dev Uthani Ekadashi": "Lord Vishnu wakes from his four-month sleep; auspicious season begins.",
  "Kartik Purnima": "Holy dip day, also celebrated as Dev Deepawali.",
  Ekadashi: "Fasting day dedicated to Lord Vishnu.",
  Purnima: "Full moon day.",
  Amavasya: "New moon day; tarpan for ancestors.",
};

type Today = ReturnType<typeof todayInIndia>;
type Selected = { date: Date; panchang: Panchang; title: string; category: Category };

const noopSubscribe = () => () => {};

function festivalCategory(name: string) {
  if (name.includes("Ekadashi")) return CATEGORIES.vrat;
  if (name.includes("Purnima")) return CATEGORIES.purnima;
  if (name.includes("Amavasya")) return CATEGORIES.amavasya;
  return CATEGORIES.festival;
}

function tithiLabel(p: Panchang) {
  return p.tithi === "Purnima" || p.tithi === "Amavasya" ? p.tithi : `${p.paksha} ${p.tithi}`;
}

function utcDay(year: number, month0: number, day: number) {
  return new Date(Date.UTC(year, month0, day)).getUTCDate();
}

const cellClass =
  "min-h-20 min-w-0 border-r border-b border-border p-1 sm:min-h-32 sm:p-1.5 [&:nth-child(7n)]:border-r-0";
const barClass =
  "block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] font-medium transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-ring sm:px-2 sm:text-xs";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="rounded-lg border border-border bg-background px-3 py-2 text-sm">{children}</dd>
    </div>
  );
}

function DetailSheet({ selected, onClose }: { selected: Selected | null; onClose: () => void }) {
  const p = selected?.panchang;
  return (
    <Sheet open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        {selected && p && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <span className={cn("size-2.5 rounded-full", selected.category.dot)} />
                {selected.title}
              </SheetTitle>
              <SheetDescription>{selected.category.label}</SheetDescription>
            </SheetHeader>
            <dl className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
              {FESTIVAL_NOTES[selected.title] && (
                <DetailRow label="About">{FESTIVAL_NOTES[selected.title]}</DetailRow>
              )}
              <DetailRow label="Date">
                {selected.date.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </DetailRow>
              <DetailRow label="Tithi (at sunrise)">{tithiLabel(p)}</DetailRow>
              <div className="grid grid-cols-2 gap-3">
                <DetailRow label="Hindu month">
                  {p.adhik ? "Adhik " : ""}
                  {p.month}
                </DetailRow>
                <DetailRow label="Paksha">{p.paksha}</DetailRow>
              </div>
              <DetailRow label="Vikram Samvat">{p.samvat}</DetailRow>
              <p className="text-xs text-muted-foreground">
                Calculated for sunrise at Barabanki · Purnimanta months
              </p>
            </dl>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MonthView({ today }: { today: Today }) {
  const [view, setView] = useState({ year: today.year, month0: today.month0 });
  const [selected, setSelected] = useState<Selected | null>(null);
  const days = useMemo(() => getMonth(view.year, view.month0), [view]);
  const leadingBlanks = new Date(Date.UTC(view.year, view.month0, 1)).getUTCDay();
  const trailingBlanks = (7 - ((leadingBlanks + days.length) % 7)) % 7;
  const title = new Date(Date.UTC(view.year, view.month0, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(view.year, view.month0 + delta, 1));
    setView({ year: d.getUTCFullYear(), month0: d.getUTCMonth() });
  };
  const isToday = (day: number) =>
    view.year === today.year && view.month0 === today.month0 && day === today.day;
  const select = (p: Panchang, title: string, category: Category) =>
    setSelected({ date: new Date(Date.UTC(view.year, view.month0, p.day)), panchang: p, title, category });
  const first = days[0];
  const last = days[days.length - 1];
  const months = first.month === last.month ? first.month : `${first.month} → ${last.month}`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-popover">
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => setView({ year: today.year, month0: today.month0 })}>
            Today
          </Button>
          <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
          <div className="flex flex-col">
            <h1 className="font-heading text-xl font-semibold sm:text-2xl">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {first.adhik || last.adhik ? "Adhik maas · " : ""}
              {months} · Vikram Samvat {last.samvat}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(CATEGORIES).slice(1).map((c) => (
            <span key={c.label} className={cn("rounded-full px-2.5 py-1 text-xs", c.className)}>
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 border-t border-border">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="border-b border-border py-2 text-center text-xs text-muted-foreground sm:text-sm"
          >
            {w}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`lead-${i}`} className={cn(cellClass, "bg-background px-2 text-sm text-muted-foreground/50")}>
            {utcDay(view.year, view.month0, i - leadingBlanks + 1)}
          </div>
        ))}
        {days.map((p) => (
          <div key={p.day} className={cn(cellClass, "flex flex-col gap-1")}>
            <span
              className={cn(
                "mx-1 flex h-7 items-center text-sm font-medium sm:text-base",
                isToday(p.day) &&
                  "w-7 justify-center rounded-full bg-foreground font-semibold text-background",
              )}
            >
              {p.day}
            </span>
            <button
              type="button"
              className={cn(barClass, CATEGORIES.tithi.className)}
              onClick={() => select(p, tithiLabel(p), CATEGORIES.tithi)}
            >
              {p.tithi !== "Purnima" && p.tithi !== "Amavasya" && (
                <span className="mr-1 hidden font-normal text-muted-foreground sm:inline">{p.paksha}</span>
              )}
              {p.tithi}
            </button>
            {p.festival && (
              <button
                type="button"
                title={p.festival}
                className={cn(barClass, festivalCategory(p.festival).className)}
                onClick={() => select(p, p.festival!, festivalCategory(p.festival!))}
              >
                {p.festival}
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: trailingBlanks }, (_, i) => (
          <div key={`trail-${i}`} className={cn(cellClass, "bg-background px-2 text-sm text-muted-foreground/50")}>
            {i + 1}
          </div>
        ))}
      </div>
      <p className="p-3 text-xs text-muted-foreground sm:px-4">
        Tithi at sunrise, Barabanki · Purnimanta months · Click any entry for details
      </p>
      <DetailSheet selected={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

export function HinduCalendar() {
  // Static export: "today" must come from the visitor's clock, never build time.
  const todayKey = useSyncExternalStore(
    noopSubscribe,
    () => JSON.stringify(todayInIndia()),
    () => null,
  );
  const today = useMemo<Today | null>(() => (todayKey ? JSON.parse(todayKey) : null), [todayKey]);

  if (!today) return <p className="text-sm text-muted-foreground">Loading Hindu calendar…</p>;
  return <MonthView today={today} />;
}
