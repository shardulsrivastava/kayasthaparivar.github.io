"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getMonth,
  getPanchang,
  nextFestival,
  todayInIndia,
  type Panchang,
} from "@/lib/panchang";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GENERIC_FESTIVALS = ["Ekadashi", "Purnima", "Amavasya"];

type Today = ReturnType<typeof todayInIndia>;

const noopSubscribe = () => () => {};

function lunarLabel(p: Panchang) {
  return `${p.adhik ? "Adhik " : ""}${p.month} ${p.paksha} ${p.tithi}`;
}

function formatShort(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

function MonthGrid({ today }: { today: Today }) {
  const [view, setView] = useState({ year: today.year, month0: today.month0 });
  const days = useMemo(() => getMonth(view.year, view.month0), [view]);
  const leadingBlanks = new Date(Date.UTC(view.year, view.month0, 1)).getUTCDay();
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

  return (
    <>
      <DialogHeader className="flex-row items-start justify-between pr-8">
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription className="text-amber-300">
            {first.month === last.month ? first.month : `${first.month} – ${last.month}`} · Vikram
            Samvat {last.samvat}
          </DialogDescription>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => shift(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => shift(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </DialogHeader>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-[11px] text-muted-foreground">
            {w}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((p) => (
          <div
            key={p.day}
            title={`${lunarLabel(p)}${p.festival ? ` · ${p.festival}` : ""}`}
            className={cn(
              "flex min-h-14 min-w-0 flex-col gap-0.5 rounded-lg p-1.5",
              p.paksha === "Shukla" ? "bg-white/10" : "bg-white/[0.03]",
              isToday(p.day) && "ring-2 ring-primary",
            )}
          >
            <span className={cn("text-sm font-semibold", p.festival && "text-amber-300")}>
              {p.day}
            </span>
            <span className="truncate text-[10px] text-muted-foreground">{p.tithi}</span>
            {p.festival && !GENERIC_FESTIVALS.includes(p.festival) && (
              <span className="truncate text-[10px] font-medium text-amber-300">{p.festival}</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-white/20 bg-white/[0.03]" />
          Krishna paksha
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-white/15" />
          Shukla paksha
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-amber-300" />
          Festival
        </span>
      </div>
    </>
  );
}

export function HinduCalendarCard() {
  // Static export: "today" must come from the visitor's clock, never build time.
  const todayKey = useSyncExternalStore(
    noopSubscribe,
    () => JSON.stringify(todayInIndia()),
    () => null,
  );

  const { today, info } = useMemo(() => {
    if (!todayKey) return { today: null, info: null };
    const today: Today = JSON.parse(todayKey);
    return {
      today,
      info: {
        panchang: getPanchang(today.year, today.month0, today.day),
        next: nextFestival(today.year, today.month0, today.day),
      },
    };
  }, [todayKey]);

  return (
    <div className="glass-panel flex flex-col gap-1 rounded-2xl border border-amber-300/40 px-4 py-4 text-left">
      {info && today ? (
        <>
          <p className="font-mono text-[10px] tracking-widest text-amber-300 uppercase">
            Today · VS {info.panchang.samvat}
          </p>
          <p className="font-heading text-base leading-tight font-semibold">
            {lunarLabel(info.panchang)}
          </p>
          {info.next && (
            <p className="text-xs text-muted-foreground">
              Next: {info.next.name} · {formatShort(info.next.date)}
            </p>
          )}
          <Dialog>
            <DialogTrigger className="mt-1 self-start text-xs text-primary hover:underline">
              View month ›
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <MonthGrid today={today} />
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Loading Hindu calendar…</p>
      )}
    </div>
  );
}
