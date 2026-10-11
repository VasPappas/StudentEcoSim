import { describe, expect, it } from "vitest";
import { createRandom } from "../core/random";
import golden from "../testdata/market-golden.json";
import {
  referenceDays,
  referenceSeed,
  referenceSettings,
  referenceTimetable,
} from "../testdata/reference-timetable";
import { checkDay } from "./accounts";
import { textbookAnswer } from "./benchmark";
import {
  createMarket,
  defaultMarketControls,
  defaultMarketSettings,
  MISSED_OUT,
  STAYED_OUT,
  TRADED,
  type MarketControls,
  type MarketDay,
} from "./market";
import { runSchedule, summarise } from "./replay";

const seeds = [1, 2, 3, 7, 42, 2026];
const steady: MarketControls = { ...defaultMarketControls, priceSpeed: 0.2 };

function run(controls: MarketControls, seed: number, days: number, settings = defaultMarketSettings): MarketDay[] {
  return runSchedule(settings, seed, [{ fromDay: 1, controls }], days);
}

describe("the stored reference run", () => {
  it("is reproduced exactly", () => {
    const days = runSchedule(referenceSettings, referenceSeed, referenceTimetable, referenceDays);
    expect(Array.from(days[0].values)).toEqual(golden.market.firstDayValues);
    expect(Array.from(days[0].costs)).toEqual(golden.market.firstDayCosts);
    expect(days.map(summarise)).toEqual(golden.market.days);
  });

  it("was recorded with the timetable the tests replay", () => {
    expect(golden.market.seed).toBe(referenceSeed);
    expect(golden.market.settings).toEqual(referenceSettings);
    expect(golden.market.timetable).toEqual(referenceTimetable);
  });
});

describe("repeatable runs", () => {
  it("gives identical days for the same seed and different agents for another", () => {
    const first = run(steady, 5, 30);
    const again = run(steady, 5, 30);
    const other = run(steady, 6, 30);
    expect(first.map(summarise)).toEqual(again.map(summarise));
    expect(Array.from(first[29].buyerStatus)).toEqual(Array.from(again[29].buyerStatus));
    expect(Array.from(first[0].values)).not.toEqual(Array.from(other[0].values));
  });

  it("lines buyers up from keenest and sellers from cheapest, inside the set ranges", () => {
    const { values, costs } = createMarket(defaultMarketSettings, 9).outlook(defaultMarketControls);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThanOrEqual(values[i - 1]);
    for (let j = 1; j < costs.length; j++) expect(costs[j]).toBeGreaterThanOrEqual(costs[j - 1]);
    expect(values[0]).toBeLessThanOrEqual(7);
    expect(values[values.length - 1]).toBeGreaterThanOrEqual(1);
    expect(costs[0]).toBeGreaterThanOrEqual(1);
    expect(costs[costs.length - 1]).toBeLessThanOrEqual(7);
  });

  it("looks ahead without changing anything", () => {
    const market = createMarket(defaultMarketSettings, 4);
    const before = market.outlook(steady);
    market.outlook({ ...steady, tax: 2, demandShift: 1.5 });
    expect(market.period).toBe(0);
    const day = market.advance(steady);
    expect(day.day).toBe(1);
    expect(day.price).toBe(before.price);
    expect(day.wanted).toBe(before.wanted);
    expect(day.offered).toBe(before.offered);
    expect(market.period).toBe(1);
    expect(market.outlook(steady).price).toBe(day.nextPrice);
  });
});

describe("the price finds the textbook answer", () => {
  const cases: [string, Partial<MarketControls>][] = [
    ["no intervention", {}],
    ["stronger demand", { demandShift: 1.3 }],
    ["weaker demand", { demandShift: 0.7 }],
    ["higher costs", { costShift: 1.3 }],
    ["a tax", { tax: 1.5 }],
    ["a subsidy", { tax: -1 }],
    ["a cap and floor that do not bite", { priceCap: 6.5, priceFloor: 1.5 }],
  ];
  for (const [name, change] of cases) {
    it(`with ${name}`, () => {
      for (const seed of seeds) {
        const controls = { ...steady, ...change };
        const days = run(controls, seed, 400);
        const last = days[days.length - 1];
        const answer = textbookAnswer(last.values, last.costs, controls);
        expect(answer.binding).toBe("none");
        // The price stops as soon as a day is balanced, which can only happen
        // inside the textbook's clearing range.
        expect(last.wanted).toBe(last.offered);
        expect(last.traded).toBe(answer.quantity);
        expect(last.price).toBeGreaterThanOrEqual(answer.priceLow);
        expect(last.price).toBeLessThanOrEqual(answer.priceHigh);
        expect(last.nextPrice).toBe(last.price);
        expect(last.totalGains).toBeCloseTo(answer.expectedGains, 9);
      }
    });
  }

  it("reaches every possible gain when left alone", () => {
    for (const seed of seeds) {
      const last = run(steady, seed, 400).at(-1)!;
      const answer = textbookAnswer(last.values, last.costs, steady);
      expect(last.totalGains).toBeCloseTo(answer.maxGains, 9);
    }
  });

  it("starts from a shortage when the opening price is low and a glut when it is high", () => {
    const low = run(steady, 2, 1, { ...defaultMarketSettings, startPrice: 2 })[0];
    expect(low.shortage).toBeGreaterThan(0);
    expect(low.surplus).toBe(0);
    expect(low.nextPrice).toBeGreaterThan(low.price);
    const high = run(steady, 2, 1, { ...defaultMarketSettings, startPrice: 6 })[0];
    expect(high.surplus).toBeGreaterThan(0);
    expect(high.shortage).toBe(0);
    expect(high.nextPrice).toBeLessThan(high.price);
  });

  it("homes in after overshooting, even at the jumpiest setting", () => {
    let flips = 0;
    for (const seed of seeds) {
      const jumpy = { ...steady, priceSpeed: 0.95 };
      const days = run(jumpy, seed, 400);
      for (let t = 1; t < days.length; t++) {
        const before = Math.sign(days[t - 1].wanted - days[t - 1].offered);
        const now = Math.sign(days[t].wanted - days[t].offered);
        if (before * now < 0) flips++;
        // Boldness only ever falls, and only by halving.
        expect([days[t - 1].boldness, days[t - 1].boldness / 2]).toContain(days[t].boldness);
      }
      const last = days[days.length - 1];
      expect(last.wanted).toBe(last.offered);
      expect(last.traded).toBe(textbookAnswer(last.values, last.costs, jumpy).quantity);
    }
    // The setting is only a test of homing in if some markets did overshoot.
    expect(flips).toBeGreaterThan(5);
  });

  it("is bold again when conditions change", () => {
    const festival = { ...steady, priceSpeed: 0.95, demandShift: 1.3 };
    const days = runSchedule(defaultMarketSettings, 3, [
      { fromDay: 1, controls: { ...steady, priceSpeed: 0.95 } },
      { fromDay: 101, controls: festival },
    ], 300);
    expect(days[99].boldness).toBeLessThan(1);
    expect(days[100].boldness).toBe(1);
    const last = days[days.length - 1];
    expect(last.wanted).toBe(last.offered);
    expect(last.traded).toBe(textbookAnswer(last.values, last.costs, festival).quantity);
    expect(last.price).toBeGreaterThan(days[99].price);
  });

  it("does not move the price when the reaction speed is zero", () => {
    const days = run({ ...steady, priceSpeed: 0 }, 2, 5);
    for (const day of days) expect(day.price).toBe(defaultMarketSettings.startPrice);
  });
});

describe("price rules", () => {
  it("holds a cap and reproduces the textbook shortage", () => {
    for (const seed of seeds) {
      const controls = { ...steady, priceCap: 3 };
      const days = run(controls, seed, 120);
      const last = days[days.length - 1];
      const answer = textbookAnswer(last.values, last.costs, controls);
      expect(answer.binding).toBe("cap");
      expect(last.price).toBe(3);
      expect(last.wanted).toBe(answer.wanted);
      expect(last.offered).toBe(answer.offered);
      expect(last.traded).toBe(answer.quantity);
      expect(last.shortage).toBe(answer.shortage);
      expect(last.surplus).toBe(0);
      expect(last.totalGains).toBeLessThan(answer.maxGains);
      for (const day of days) expect(day.price).toBeLessThanOrEqual(3);
    }
  });

  it("holds a floor and reproduces the textbook glut", () => {
    for (const seed of seeds) {
      const controls = { ...steady, priceFloor: 5 };
      const days = run(controls, seed, 120);
      const last = days[days.length - 1];
      const answer = textbookAnswer(last.values, last.costs, controls);
      expect(answer.binding).toBe("floor");
      expect(last.price).toBe(5);
      expect(last.traded).toBe(answer.quantity);
      expect(last.surplus).toBe(answer.surplus);
      expect(last.shortage).toBe(0);
      expect(last.totalGains).toBeLessThan(answer.maxGains);
      for (const day of days) expect(day.price).toBeGreaterThanOrEqual(5);
    }
  });

  it("draws lots fairly among willing buyers under a cap", () => {
    const controls = { ...steady, priceCap: 3 };
    const days = run(controls, 2, 4000).slice(50);
    const { wanted, traded } = days[0];
    const served = new Array<number>(wanted).fill(0);
    let gains = 0;
    for (const day of days) {
      expect(day.wanted).toBe(wanted);
      expect(day.traded).toBe(traded);
      for (let i = 0; i < wanted; i++) if (day.buyerStatus[i] === TRADED) served[i]++;
      gains += day.totalGains;
    }
    const chance = traded / wanted;
    // Each willing buyer should be served about `chance` of the time: within five standard errors.
    const margin = 5 * Math.sqrt((chance * (1 - chance)) / days.length);
    for (const count of served) expect(Math.abs(count / days.length - chance)).toBeLessThan(margin);
    // And the average day's gains match the textbook's expectation under lots.
    const answer = textbookAnswer(days[0].values, days[0].costs, controls);
    expect(gains / days.length / answer.expectedGains).toBeCloseTo(1, 2);
    expect(answer.expectedGains).toBeLessThan(answer.maxGains);
  });

  it("marks every agent as staying out, trading or missing out", () => {
    const day = run({ ...steady, priceCap: 3 }, 2, 60).at(-1)!;
    const count = (status: Uint8Array, kind: number) => status.filter((s) => s === kind).length;
    expect(count(day.buyerStatus, TRADED)).toBe(day.traded);
    expect(count(day.buyerStatus, MISSED_OUT)).toBe(day.shortage);
    expect(count(day.buyerStatus, STAYED_OUT)).toBe(100 - day.wanted);
    expect(count(day.sellerStatus, TRADED)).toBe(day.traded);
    expect(count(day.sellerStatus, MISSED_OUT)).toBe(0);
  });
});

describe("the books balance", () => {
  it("on every day under randomly changing rules", () => {
    const dice = createRandom(99);
    for (const seed of seeds) {
      const market = createMarket({ ...defaultMarketSettings, startPrice: 0.5 + 8 * dice.next() }, seed);
      for (let day = 0; day < 300; day++) {
        const floor = dice.next() < 0.3 ? 0.5 + 4 * dice.next() : null;
        const cap = dice.next() < 0.3 ? (floor ?? 0.5) + 4 * dice.next() : null;
        const controls: MarketControls = {
          demandShift: 0.5 + dice.next(),
          costShift: 0.5 + dice.next(),
          tax: dice.next() < 0.5 ? 0 : -2 + 5 * dice.next(),
          priceCap: cap,
          priceFloor: floor,
          priceSpeed: 0.95 * dice.next(),
        };
        const result = market.advance(controls);
        expect(checkDay(result)).toEqual([]);
        expect(result.price).toBeGreaterThan(0);
        expect(result.nextPrice).toBeGreaterThan(0);
        expect(result.shortage === 0 || result.surplus === 0).toBe(true);
      }
    }
  });

  it("the checker notices a tampered day", () => {
    const day = run(steady, 2, 20).at(-1)!;
    expect(checkDay(day)).toEqual([]);
    expect(checkDay({ ...day, traded: day.traded + 1 })).not.toEqual([]);
    expect(checkDay({ ...day, buyerGains: day.buyerGains + 1 })).not.toEqual([]);
    expect(checkDay({ ...day, taxRevenue: 5 })).not.toEqual([]);
    const forced = day.buyerStatus.slice();
    forced[forced.length - 1] = TRADED;
    expect(checkDay({ ...day, buyerStatus: forced })).not.toEqual([]);
  });
});

describe("what the engine refuses", () => {
  it("rejects settings it cannot run", () => {
    const bad = [
      { buyers: 0 },
      { sellers: 2.5 },
      { lowestValue: 0 },
      { highestValue: 0.5 },
      { highestCost: Number.NaN },
      { startPrice: -1 },
    ];
    for (const change of bad) {
      expect(() => createMarket({ ...defaultMarketSettings, ...change }, 1)).toThrow(RangeError);
    }
  });

  it("rejects controls it cannot run and leaves the market untouched", () => {
    const market = createMarket(defaultMarketSettings, 1);
    const bad: Partial<MarketControls>[] = [
      { demandShift: 0 },
      { costShift: -1 },
      { tax: Number.POSITIVE_INFINITY },
      { priceCap: 0 },
      { priceFloor: -2 },
      { priceCap: 2, priceFloor: 3 },
      { priceSpeed: 1 },
      { priceSpeed: -0.1 },
    ];
    for (const change of bad) {
      expect(() => market.advance({ ...defaultMarketControls, ...change })).toThrow(RangeError);
    }
    expect(market.period).toBe(0);
  });
});
