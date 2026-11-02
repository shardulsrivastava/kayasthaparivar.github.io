"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { getMonth, todayInIndia, type Panchang } from "@/lib/panchang";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORIES = {
  festival: { label: "Festival", className: "bg-orange-950 text-orange-300" },
  vrat: { label: "Ekadashi / vrat", className: "bg-emerald-950 text-emerald-300" },
  purnima: { label: "Purnima", className: "bg-sky-950 text-sky-300" },
  amavasya: { label: "Amavasya", className: "bg-violet-950 text-violet-300" },
};

type Today = ReturnType<typeof todayInIndia>;

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

const cellClass = "min-h-20 min-w-0 border-r border-b border-border p-1.5 sm:min-h-32 sm:p-2 [&:nth-child(7n)]:border-r-0";

function MonthView({ today }: { today: Today }) {
  const [view, setView] = useState({ year: today.year, month0: today.month0 });
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
            <h1 className="font-heading text-xl font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {first.adhik || last.adhik ? "Adhik maas · " : ""}
              {months} · Vikram Samvat {last.samvat}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(CATEGORIES).map((c) => (
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
          <div key={`lead-${i}`} className={cn(cellClass, "bg-background text-sm text-muted-foreground/50")}>
            {utcDay(view.year, view.month0, i - leadingBlanks + 1)}
          </div>
        ))}
        {days.map((p) => (
          <div key={p.day} className={cn(cellClass, "flex flex-col gap-1")}>
            <span
              className={cn(
                "flex h-7 items-center text-sm font-medium",
                isToday(p.day) &&
                  "w-7 justify-center rounded-full bg-foreground font-semibold text-background",
              )}
            >
              {p.day}
            </span>
            <span className="text-[11px] leading-tight text-foreground/80 sm:text-xs">
              <span className="hidden sm:inline">{tithiLabel(p)}</span>
              <span className="sm:hidden">{p.tithi}</span>
            </span>
            {p.festival && (
              <span
                title={p.festival}
                className={cn(
                  "truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium sm:px-2 sm:text-xs",
                  festivalCategory(p.festival).className,
                )}
              >
                {p.festival}
              </span>
            )}
          </div>
        ))}
        {Array.from({ length: trailingBlanks }, (_, i) => (
          <div key={`trail-${i}`} className={cn(cellClass, "bg-background text-sm text-muted-foreground/50")}>
            {i + 1}
          </div>
        ))}
      </div>
      <p className="p-3 text-xs text-muted-foreground sm:px-4">
        Tithi at sunrise, Barabanki · Purnimanta months
      </p>
    </div>
  );
}

export function HinduCalendar2() {
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
