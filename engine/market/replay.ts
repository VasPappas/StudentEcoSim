/**
 * Run a market for a number of days under a timetable of controls.
 *
 * Used by the tests, by the stored reference run and by the command-line
 * script, so that all three run a market in exactly the same way.
 */
import { createMarket, type MarketControls, type MarketDay, type MarketSettings } from "./market";

export interface ScheduledControls {
  /** These controls apply from this day (counting from 1) until a later entry takes over. */
  fromDay: number;
  controls: MarketControls;
}

export function runSchedule(
  settings: MarketSettings,
  seed: number,
  schedule: ScheduledControls[],
  days: number,
): MarketDay[] {
  if (schedule.length === 0 || schedule[0].fromDay !== 1) {
    throw new RangeError("The timetable must start on day 1.");
  }
  for (let k = 1; k < schedule.length; k++) {
    if (schedule[k].fromDay <= schedule[k - 1].fromDay) {
      throw new RangeError("Timetable entries must be in order of their starting day.");
    }
  }
  const market = createMarket(settings, seed);
  const result: MarketDay[] = [];
  let entry = 0;
  for (let day = 1; day <= days; day++) {
    while (entry + 1 < schedule.length && schedule[entry + 1].fromDay <= day) entry++;
    result.push(market.advance(schedule[entry].controls));
  }
  return result;
}

/** The plain numbers of one day, without the per-agent arrays. */
export interface DaySummary {
  day: number;
  price: number;
  sellerPrice: number;
  wanted: number;
  offered: number;
  traded: number;
  shortage: number;
  surplus: number;
  buyerGains: number;
  sellerGains: number;
  taxRevenue: number;
  totalGains: number;
  boldness: number;
  nextPrice: number;
}

export function summarise(day: MarketDay): DaySummary {
  return {
    day: day.day,
    price: day.price,
    sellerPrice: day.sellerPrice,
    wanted: day.wanted,
    offered: day.offered,
    traded: day.traded,
    shortage: day.shortage,
    surplus: day.surplus,
    buyerGains: day.buyerGains,
    sellerGains: day.sellerGains,
    taxRevenue: day.taxRevenue,
    totalGains: day.totalGains,
    boldness: day.boldness,
    nextPrice: day.nextPrice,
  };
}
