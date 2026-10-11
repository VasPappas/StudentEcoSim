/**
 * The stored reference run: one market taken through every rule in turn.
 *
 * scripts/write-golden.ts runs this timetable and saves the results to
 * market-golden.json. The tests replay it and require identical numbers, and
 * a version of the engine in another language can be checked the same way.
 */
import { defaultMarketControls, defaultMarketSettings, type MarketSettings } from "../market/market";
import type { ScheduledControls } from "../market/replay";

export const referenceSeed = 2;
export const referenceDays = 90;
export const referenceSettings: MarketSettings = { ...defaultMarketSettings };

export const referenceTimetable: ScheduledControls[] = [
  { fromDay: 1, controls: { ...defaultMarketControls } },
  { fromDay: 16, controls: { ...defaultMarketControls, demandShift: 1.3 } },
  { fromDay: 31, controls: { ...defaultMarketControls, costShift: 1.3 } },
  { fromDay: 46, controls: { ...defaultMarketControls, tax: 1.5 } },
  { fromDay: 61, controls: { ...defaultMarketControls, priceCap: 3 } },
  { fromDay: 76, controls: { ...defaultMarketControls, priceFloor: 5, priceSpeed: 0.9 } },
];

export const referenceRandomSeed = 20261011;
export const referenceRandomCount = 8;
