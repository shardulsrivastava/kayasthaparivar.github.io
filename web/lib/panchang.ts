import {
  Body,
  MoonPhase,
  Observer,
  SearchMoonPhase,
  SearchRiseSet,
  SunPosition,
} from "astronomy-engine";

const BARABANKI = new Observer(26.93, 81.19, 120);
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const DAY_MS = 86400 * 1000;
const SYNODIC_DAYS = 29.530588;

const TITHIS = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
  "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
  "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi",
];

const MONTHS = [
  "Chaitra", "Vaishakha", "Jyeshtha", "Ashadha", "Shravana", "Bhadrapada",
  "Ashvin", "Kartik", "Margashirsha", "Pausha", "Magha", "Phalguna",
];

type Observance = "sunrise" | "madhyahna" | "aparahna" | "sunset" | "midnight";

// Key: "<Purnimanta month>-<paksha>-<tithi 1..15>". Krishna 15 = Amavasya.
// Observance = when the tithi must prevail for the festival to fall on that day.
const FESTIVALS: [key: string, name: string, at: Observance][] = [
  ["Magha-Shukla-5", "Vasant Panchami", "sunrise"],
  ["Phalguna-Krishna-14", "Maha Shivaratri", "midnight"],
  ["Chaitra-Krishna-1", "Holi", "sunrise"],
  ["Chaitra-Shukla-9", "Ram Navami", "madhyahna"],
  ["Shravana-Shukla-15", "Raksha Bandhan", "sunrise"],
  ["Bhadrapada-Krishna-8", "Janmashtami", "midnight"],
  ["Ashvin-Shukla-10", "Dussehra", "aparahna"],
  ["Kartik-Krishna-15", "Diwali", "sunset"],
  ["Kartik-Shukla-1", "Govardhan Puja", "sunrise"],
  ["Kartik-Shukla-2", "Chitragupta Puja · Bhai Dooj", "sunrise"],
  ["Kartik-Shukla-6", "Chhath Puja", "sunrise"],
  ["Kartik-Shukla-11", "Dev Uthani Ekadashi", "sunrise"],
  ["Kartik-Shukla-15", "Kartik Purnima", "sunrise"],
];
const FESTIVAL_NAMES = new Set(FESTIVALS.map(([, name]) => name));

export type Paksha = "Shukla" | "Krishna";

export type Panchang = {
  day: number;
  month: string;
  adhik: boolean;
  paksha: Paksha;
  tithi: string;
  samvat: number;
  festival?: string;
};

function istMidnight(year: number, month0: number, day: number) {
  return new Date(Date.UTC(year, month0, day) - IST_OFFSET_MS);
}

function sunEvent(start: Date, direction: 1 | -1) {
  return SearchRiseSet(Body.Sun, BARABANKI, direction, start, 1)?.date ?? start;
}

// ponytail: linear Lahiri ayanamsa approximation (~0.01° drift/century); swap
// for a full precession model only if a sankranti-edge month is ever wrong.
function siderealSunSign(t: Date) {
  const years = (t.getTime() - Date.UTC(2000, 0, 1)) / (365.25 * DAY_MS);
  const ayanamsa = 23.853 + years * 0.013969;
  const lon = (SunPosition(t).elon - ayanamsa + 360) % 360;
  return Math.floor(lon / 30);
}

function amantaMonth(t: Date) {
  const daysSinceNew = (MoonPhase(t) / 360) * SYNODIC_DAYS;
  const guess = new Date(t.getTime() - (daysSinceNew + 2) * DAY_MS);
  const prevNew = SearchMoonPhase(0, guess, 4)!.date;
  const nextNew = SearchMoonPhase(0, new Date(prevNew.getTime() + DAY_MS), 32)!.date;
  const sign = siderealSunSign(prevNew);
  return { index: (sign + 1) % 12, adhik: sign === siderealSunSign(nextNew) };
}

function lunarDay(t: Date) {
  const index = Math.floor(MoonPhase(t) / 12);
  const paksha: Paksha = index < 15 ? "Shukla" : "Krishna";
  const number = (index % 15) + 1;
  const amanta = amantaMonth(t);
  const monthIndex = paksha === "Krishna" ? (amanta.index + 1) % 12 : amanta.index;
  return { paksha, number, amanta, month: MONTHS[monthIndex] };
}

function tithiName(paksha: Paksha, number: number) {
  if (number === 15) return paksha === "Shukla" ? "Purnima" : "Amavasya";
  return TITHIS[number - 1];
}

function observanceTimes(year: number, month0: number, day: number): Record<Observance, Date> {
  const sunrise = sunEvent(istMidnight(year, month0, day), 1);
  const sunset = sunEvent(istMidnight(year, month0, day), -1);
  const dayFraction = (f: number) =>
    new Date(sunrise.getTime() + (sunset.getTime() - sunrise.getTime()) * f);
  return {
    sunrise,
    madhyahna: dayFraction(0.5),
    aparahna: dayFraction(0.6),
    sunset,
    midnight: istMidnight(year, month0, day + 1),
  };
}

function festivalMatching(year: number, month0: number, day: number) {
  const times = observanceTimes(year, month0, day);
  return FESTIVALS.find(([key, , at]) => {
    const d = lunarDay(times[at]);
    return key === `${d.month}-${d.paksha}-${d.number}`;
  })?.[1];
}

// ponytail: festivals use a fixed observance time and ignore Bhadra, eclipse
// and kshaya-tithi rules, so an edge-case festival can land a day off.
export function getPanchang(year: number, month0: number, day: number): Panchang {
  const sunrise = lunarDay(observanceTimes(year, month0, day).sunrise);
  const tithi = tithiName(sunrise.paksha, sunrise.number);
  const matched = festivalMatching(year, month0, day);
  const named = matched && festivalMatching(year, month0, day - 1) !== matched ? matched : undefined;
  const generic = ["Ekadashi", "Purnima", "Amavasya"].includes(tithi) ? tithi : undefined;

  return {
    day,
    month: sunrise.month,
    adhik: sunrise.amanta.adhik,
    paksha: sunrise.paksha,
    tithi,
    samvat: year + (sunrise.amanta.index >= 9 && month0 <= 3 ? 56 : 57),
    festival: named ?? generic,
  };
}

export function getMonth(year: number, month0: number): Panchang[] {
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => getPanchang(year, month0, i + 1));
}

export function nextFestival(year: number, month0: number, day: number, limitDays = 90) {
  for (let i = 1; i <= limitDays; i++) {
    const date = new Date(Date.UTC(year, month0, day + i));
    const p = getPanchang(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    if (p.festival && FESTIVAL_NAMES.has(p.festival)) return { date, name: p.festival };
  }
  return null;
}

export function todayInIndia() {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  return { year: now.getUTCFullYear(), month0: now.getUTCMonth(), day: now.getUTCDate() };
}
