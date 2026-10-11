/**
 * The textbook answer for the same buyers and sellers.
 *
 * This is the supply-and-demand calculation from a first microeconomics
 * course, worked out directly from the list of values and costs. It shares no
 * code with the simulation in market.ts, so the two can be checked against
 * each other: the interface draws this as "what the textbook says", and the
 * tests require the simulation to settle on it.
 */

export interface MarketRules {
  /** Tax per unit, taken out of what buyers pay. Negative is a subsidy. */
  tax: number;
  priceCap: number | null;
  priceFloor: number | null;
}

export interface TextbookAnswer {
  /** Units traded. */
  quantity: number;
  /** What buyers pay. With no binding price rule, the middle of the clearing range. */
  price: number;
  /** What sellers keep: price less tax. */
  sellerPrice: number;
  /** Every buyer price from priceLow to priceHigh clears the market when no price rule binds. */
  priceLow: number;
  priceHigh: number;
  /** Which legal price rule, if any, holds the price away from the clearing range. */
  binding: "none" | "cap" | "floor";
  /** Willing buyers and willing sellers at `price`. */
  wanted: number;
  offered: number;
  shortage: number;
  surplus: number;
  /** Total gains (buyers + sellers + tax) expected under these rules when lots decide who trades. */
  expectedGains: number;
  /** The largest total gains these buyers and sellers could ever reach. */
  maxGains: number;
}

function sorted(list: ArrayLike<number>, direction: "highFirst" | "lowFirst"): number[] {
  const copy = Array.from(list);
  copy.sort((a, b) => (direction === "highFirst" ? b - a : a - b));
  return copy;
}

/** The largest number of units worth trading when each unit costs `tax` extra. */
function unitsWorthTrading(values: number[], costs: number[], tax: number): number {
  let quantity = 0;
  const limit = Math.min(values.length, costs.length);
  while (quantity < limit && values[quantity] >= costs[quantity] + tax) quantity++;
  return quantity;
}

function sum(list: number[], count: number): number {
  let total = 0;
  for (let k = 0; k < count; k++) total += list[k];
  return total;
}

export function textbookAnswer(
  buyerValues: ArrayLike<number>,
  sellerCosts: ArrayLike<number>,
  rules: MarketRules,
): TextbookAnswer {
  if (buyerValues.length < 1 || sellerCosts.length < 1) {
    throw new RangeError("The textbook answer needs at least one buyer and one seller.");
  }
  if (rules.priceCap !== null && rules.priceFloor !== null && rules.priceFloor > rules.priceCap) {
    throw new RangeError("priceFloor cannot be above priceCap.");
  }
  const values = sorted(buyerValues, "highFirst");
  const costs = sorted(sellerCosts, "lowFirst");
  const { tax } = rules;

  // Where the demand and supply staircases cross.
  const crossing = unitsWorthTrading(values, costs, tax);
  // Any buyer price in this range brings out exactly `crossing` buyers and sellers.
  const priceLow = Math.max(
    crossing < values.length ? values[crossing] : -Infinity,
    crossing > 0 ? costs[crossing - 1] + tax : -Infinity,
  );
  const priceHigh = Math.min(
    crossing > 0 ? values[crossing - 1] : Infinity,
    crossing < costs.length ? costs[crossing] + tax : Infinity,
  );

  // A legal price rule binds only when it shuts out the whole clearing range.
  let price: number;
  let binding: TextbookAnswer["binding"] = "none";
  if (rules.priceFloor !== null && rules.priceFloor > priceHigh) {
    price = rules.priceFloor;
    binding = "floor";
  } else if (rules.priceCap !== null && rules.priceCap < priceLow) {
    price = rules.priceCap;
    binding = "cap";
  } else {
    const low = rules.priceFloor === null ? priceLow : Math.max(priceLow, rules.priceFloor);
    const high = rules.priceCap === null ? priceHigh : Math.min(priceHigh, rules.priceCap);
    price = (low + high) / 2;
  }

  const sellerPrice = price - tax;
  const wanted = binding === "none" ? crossing : values.filter((v) => v >= price).length;
  const offered = binding === "none" ? crossing : costs.filter((c) => c <= sellerPrice).length;
  const quantity = Math.min(wanted, offered);

  // The short side all trade. On the long side each willing agent is equally
  // likely to be drawn, so the expected gain is the average gain of the willing
  // times the number who get to trade.
  const buyersGain = wanted === 0 ? 0 : ((sum(values, wanted) - wanted * price) / wanted) * quantity;
  const sellersGain = offered === 0 ? 0 : ((offered * sellerPrice - sum(costs, offered)) / offered) * quantity;
  const expectedGains = buyersGain + sellersGain + tax * quantity;

  const best = unitsWorthTrading(values, costs, 0);
  const maxGains = sum(values, best) - sum(costs, best);

  return {
    quantity,
    price,
    sellerPrice,
    priceLow,
    priceHigh,
    binding,
    wanted,
    offered,
    shortage: wanted - quantity,
    surplus: offered - quantity,
    expectedGains,
    maxGains,
  };
}
