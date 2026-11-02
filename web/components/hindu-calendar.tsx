"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { getMonth, todayInIndia } from "@/lib/panchang";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GENERIC_FESTIVALS = ["Ekadashi", "Purnima", "Amavasya"];
const TITHI_HINDI: Record<string, string> = {
  Pratipada: "प्रतिपदा", Dwitiya: "द्वितीया", Tritiya: "तृतीया", Chaturthi: "चतुर्थी",
  Panchami: "पंचमी", Shashthi: "षष्ठी", Saptami: "सप्तमी", Ashtami: "अष्टमी",
  Navami: "नवमी", Dashami: "दशमी", Ekadashi: "एकादशी", Dwadashi: "द्वादशी",
  Trayodashi: "त्रयोदशी", Chaturdashi: "चतुर्दशी", Purnima: "पूर्णिमा", Amavasya: "अमावस्या",
};

type Today = ReturnType<typeof todayInIndia>;

const noopSubscribe = () => () => {};

function MonthView({ today }: { today: Today }) {
  const [view, setView] = useState({ year: today.year, month0: today.month0 });
  const days = useMemo(() => getMonth(view.year, view.month0), [view]);
  const firstOfMonth = new Date(Date.UTC(view.year, view.month0, 1));
  const leadingBlanks = firstOfMonth.getUTCDay();
  const title = firstOfMonth.toLocaleDateString("en-IN", {
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-amber-300">
            {first.adhik || last.adhik ? "Adhik maas · " : ""}
            {months} · Vikram Samvat {last.samvat}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView({ year: today.year, month0: today.month0 })}>
            Today
          </Button>
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS.map((w) => (
          <span key={w} className="px-1 text-xs text-muted-foreground sm:px-2">
            {w}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((p) => (
          <div
            key={p.day}
            title={`${p.month} ${p.paksha} ${p.tithi}${p.festival ? ` · ${p.festival}` : ""}`}
            className={cn(
              "flex min-h-20 min-w-0 flex-col gap-1 rounded-lg border border-white/10 p-1.5 sm:min-h-28 sm:p-2",
              p.paksha === "Shukla" ? "bg-white/[0.08]" : "bg-white/[0.02]",
              isToday(p.day) && "ring-2 ring-primary",
            )}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className={cn("text-base font-semibold sm:text-lg", p.festival && "text-amber-300")}>
                {p.day}
              </span>
              <span lang="hi" className="hidden truncate text-[11px] text-muted-foreground sm:inline">
                {TITHI_HINDI[p.tithi]}
              </span>
            </div>
            <span className="truncate text-[10px] text-muted-foreground sm:text-xs">
              <span className="hidden sm:inline">{p.paksha} </span>
              {p.tithi}
            </span>
            {p.festival && !GENERIC_FESTIVALS.includes(p.festival) && (
              <span className="self-start truncate rounded-md bg-amber-300 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950 sm:text-[11px] max-w-full">
                {p.festival}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-white/20 bg-white/[0.02]" />
          Krishna paksha
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-white/15" />
          Shukla paksha
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-amber-300" />
          Festival
        </span>
        <span>Tithi at sunrise, Barabanki · Purnimanta months</span>
      </div>
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
