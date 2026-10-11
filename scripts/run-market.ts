/**
 * Run the stage 1 market without the interface and print one CSV row per day.
 *
 *   npm run sim -- --days 60 --seed 2 --tax 1.5 --cap 3 > market.csv
 *
 * Options: --days --seed --demand --costs --tax --cap --floor --speed --start
 */
import { defaultMarketControls, defaultMarketSettings, type MarketControls } from "../engine/market/market";
import { runSchedule, summarise } from "../engine/market/replay";

const args = new Map<string, string>();
for (let k = 2; k + 1 < process.argv.length; k += 2) {
  args.set(process.argv[k].replace(/^--/, ""), process.argv[k + 1]);
}
const number = (name: string, fallback: number): number => {
  const text = args.get(name);
  if (text === undefined) return fallback;
  const value = Number(text);
  if (!Number.isFinite(value)) throw new RangeError(`--${name} needs a number.`);
  return value;
};
const optional = (name: string): number | null => (args.has(name) ? number(name, 0) : null);

const controls: MarketControls = {
  demandShift: number("demand", defaultMarketControls.demandShift),
  costShift: number("costs", defaultMarketControls.costShift),
  tax: number("tax", defaultMarketControls.tax),
  priceCap: optional("cap"),
  priceFloor: optional("floor"),
  priceSpeed: number("speed", defaultMarketControls.priceSpeed),
};
const settings = { ...defaultMarketSettings, startPrice: number("start", defaultMarketSettings.startPrice) };
const days = runSchedule(settings, number("seed", 2), [{ fromDay: 1, controls }], number("days", 60));

const rows = days.map(summarise);
const columns = Object.keys(rows[0]) as (keyof (typeof rows)[number])[];
console.log(columns.join(","));
for (const row of rows) console.log(columns.map((column) => row[column]).join(","));
