/**
 * Each mission should come out the way a first-year textbook says it does,
 * in every town, without the outcome being written into the mission itself.
 */
import { describe, expect, it } from "vitest";
import {
  createMarket,
  defaultMarketControls,
  defaultMarketSettings,
  textbookAnswer,
  type MarketDay,
} from "../../engine/market";
import { LOW_START_PRICE, missions, type Mission } from "./missions";

function playMission(mission: Mission, seed: number): { before: MarketDay; after: MarketDay } {
  const base = defaultMarketControls;
  const scout = createMarket(defaultMarketSettings, seed).outlook(base);
  const restingPrice = textbookAnswer(scout.values, scout.costs, base).price;
  const startPrice = mission.start === "low" ? LOW_START_PRICE : restingPrice;
  const market = createMarket({ ...defaultMarketSettings, startPrice }, seed);

  let before: MarketDay | null = null;
  if (mission.start === "settled") {
    for (let k = 0; k < 3; k++) before = market.advance(base);
  }
  const controls = { ...base, ...mission.change(restingPrice) };
  let after = market.advance(controls);
  before ??= after;
  for (let day = 1; day < 80 && after.nextPrice !== after.price; day++) after = market.advance(controls);
  return { before, after };
}

const expected: Record<string, Record<string, string>> = {
  "find-the-price": { "first-day": "shortage", settles: "up" },
  festival: { price: "up", sold: "up" },
  flour: { price: "up", sold: "down" },
  "price-cap": { crowd: "shortage", sold: "down" },
  "bread-tax": { burden: "less", sold: "down" },
};

describe("missions", () => {
  it("cover every expected outcome and nothing else", () => {
    expect(missions.map((mission) => mission.id)).toEqual(Object.keys(expected));
    for (const mission of missions) {
      expect(mission.questions.map((question) => question.id)).toEqual(Object.keys(expected[mission.id]));
    }
  });

  for (const mission of missions) {
    it(`"${mission.title}" comes out as the textbook says in every town`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const { before, after } = playMission(mission, seed);
        expect(after.nextPrice).toBe(after.price);
        for (const question of mission.questions) {
          const outcome = question.outcome(before, after);
          expect(question.choices.map((choice) => choice.id)).toContain(outcome);
          expect(outcome).toBe(expected[mission.id][question.id]);
          expect(question.report(before, after).length).toBeGreaterThan(20);
        }
        expect(mission.lesson(before, after)).not.toMatch(/NaN|undefined|-€/);
      }
    });
  }

  it("start settled missions from a market at rest", () => {
    for (const mission of missions.filter((candidate) => candidate.start === "settled")) {
      const { before } = playMission(mission, 2);
      expect(before.shortage).toBe(0);
      expect(before.surplus).toBe(0);
    }
  });
});
