import assert from "node:assert/strict";
import { getMonth, getPanchang } from "../lib/panchang.ts";

const nov1 = getPanchang(2026, 10, 1);
assert.deepEqual(
  [nov1.month, nov1.paksha, nov1.tithi, nov1.samvat],
  ["Kartik", "Krishna", "Saptami", 2083],
);

const published2026 = {
  "1/23": "Vasant Panchami",
  "2/15": "Maha Shivaratri",
  "3/4": "Holi",
  "3/26": "Ram Navami",
  "8/28": "Raksha Bandhan",
  "9/4": "Janmashtami",
  "10/20": "Dussehra",
  "11/8": "Diwali",
  "11/11": "Chitragupta Puja · Bhai Dooj",
};

const named = new Map(
  Array.from({ length: 12 }, (_, m) => getMonth(2026, m)).flatMap((days, m) =>
    days.map((d) => [`${m + 1}/${d.day}`, d.festival]),
  ),
);
for (const [date, festival] of Object.entries(published2026)) {
  assert.equal(named.get(date), festival, date);
}
assert.equal([...named.values()].filter((f) => f === "Dussehra").length, 1);

console.log("panchang checks passed");
