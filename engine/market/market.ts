/**
 * Stage 1: one market for one good.
 *
 * Every buyer wants one unit a day and has a private value: the most they
 * would pay. Every seller has one unit a day to offer and a private cost: the
 * least they would accept. Everyone sees one going price. Whoever is happy to
 * trade at that price turns up; if one side outnumbers the other, who gets to
 * trade is drawn by lot. Overnight the going price moves towards the crowded
 * side, and moves half as boldly each time it overshoots. Nothing else happens.
 *
 * The rules are written out in docs/model-cards/stage-1-market.md. This file
 * uses only + - * / and comparisons on ordinary doubles, so another language
 * can reproduce it exactly.
 */
import type { Simulation } from "../core/contract";
import { createRandom } from "../core/random";

export interface MarketSettings {
  /** Number of buyers; each wants one unit a day. */
  buyers: number;
  /** Number of sellers; each can offer one unit a day. */
  sellers: number;
  /** Buyers' values are drawn evenly between these two amounts. */
  lowestValue: number;
  highestValue: number;
  /** Sellers' costs are drawn evenly between these two amounts. */
  lowestCost: number;
  highestCost: number;
  /** The going price on the first day. */
  startPrice: number;
}

export interface MarketControls {
  /** Multiplies every buyer's value. 1 leaves demand where it started. */
  demandShift: number;
  /** Multiplies every seller's cost. 1 leaves supply where it started. */
  costShift: number;
  /** Tax per unit, taken out of what buyers pay. Negative is a subsidy. */
  tax: number;
  /** Highest price buyers may legally be charged, or null for no cap. */
  priceCap: number | null;
  /** Lowest price buyers may legally be charged, or null for no floor. */
  priceFloor: number | null;
  /** How strongly the price reacts to a crowd on one side: 0 up to 0.95. */
  priceSpeed: number;
}

/** What an agent did on a given day. */
export const STAYED_OUT = 0;
export const TRADED = 1;
export const MISSED_OUT = 2;

export interface MarketOutlook {
  /** The day this describes, counting from 1. */
  day: number;
  /** What buyers pay per unit. */
  price: number;
  /** What sellers keep per unit: the price less the tax. */
  sellerPrice: number;
  /** Buyers willing to buy at this price. */
  wanted: number;
  /** Sellers willing to sell at this price. */
  offered: number;
  /** Each buyer's value that day, highest first. */
  values: Float64Array;
  /** Each seller's cost that day, lowest first. */
  costs: Float64Array;
  /** The rules in force. */
  controls: MarketControls;
}

export interface MarketDay extends MarketOutlook {
  /** Units that changed hands. */
  traded: number;
  /** Willing buyers who went home without. */
  shortage: number;
  /** Willing sellers left with their unit. */
  surplus: number;
  /** Sum of (value - price) over buyers who bought: consumer surplus. */
  buyerGains: number;
  /** Sum of (seller price - cost) over sellers who sold: producer surplus. */
  sellerGains: number;
  /** Tax collected (negative when a subsidy is paid out). */
  taxRevenue: number;
  /** buyerGains + sellerGains + taxRevenue. */
  totalGains: number;
  /**
   * How boldly the price moved overnight: 1 at first, halved each time a
   * shortage is followed by a glut or the other way round, and back to 1
   * whenever the controls change.
   */
  boldness: number;
  /** The going price carried into the next day. */
  nextPrice: number;
  /** One status per buyer, in the same order as `values`. */
  buyerStatus: Uint8Array;
  /** One status per seller, in the same order as `costs`. */
  sellerStatus: Uint8Array;
}

export type Market = Simulation<MarketControls, MarketDay, MarketOutlook>;

export const defaultMarketSettings: MarketSettings = {
  buyers: 100,
  sellers: 100,
  lowestValue: 1,
  highestValue: 7,
  lowestCost: 1,
  highestCost: 7,
  startPrice: 2,
};

export const defaultMarketControls: MarketControls = {
  demandShift: 1,
  costShift: 1,
  tax: 0,
  priceCap: null,
  priceFloor: null,
  priceSpeed: 0.35,
};

/** The largest price reaction the rule allows while keeping prices positive. */
export const MAX_PRICE_SPEED = 0.95;

function positive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number.`);
  }
}

function checkSettings(s: MarketSettings): void {
  for (const [name, count] of [["buyers", s.buyers], ["sellers", s.sellers]] as const) {
    if (!Number.isInteger(count) || count < 1 || count > 100000) {
      throw new RangeError(`${name} must be a whole number from 1 to 100000.`);
    }
  }
  positive("lowestValue", s.lowestValue);
  positive("lowestCost", s.lowestCost);
  positive("startPrice", s.startPrice);
  if (!Number.isFinite(s.highestValue) || s.highestValue < s.lowestValue) {
    throw new RangeError("highestValue must be at least lowestValue.");
  }
  if (!Number.isFinite(s.highestCost) || s.highestCost < s.lowestCost) {
    throw new RangeError("highestCost must be at least lowestCost.");
  }
}

export function checkControls(c: MarketControls): void {
  positive("demandShift", c.demandShift);
  positive("costShift", c.costShift);
  if (!Number.isFinite(c.tax)) {
    throw new RangeError("tax must be a number.");
  }
  if (c.priceCap !== null) positive("priceCap", c.priceCap);
  if (c.priceFloor !== null) positive("priceFloor", c.priceFloor);
  if (c.priceCap !== null && c.priceFloor !== null && c.priceFloor > c.priceCap) {
    throw new RangeError("priceFloor cannot be above priceCap.");
  }
  if (!Number.isFinite(c.priceSpeed) || c.priceSpeed < 0 || c.priceSpeed > MAX_PRICE_SPEED) {
    throw new RangeError(`priceSpeed must be between 0 and ${MAX_PRICE_SPEED}.`);
  }
}

/** The going price after any legal floor and cap: floor first, then cap. */
export function legalPrice(price: number, controls: MarketControls): number {
  let legal = price;
  if (controls.priceFloor !== null && legal < controls.priceFloor) legal = controls.priceFloor;
  if (controls.priceCap !== null && legal > controls.priceCap) legal = controls.priceCap;
  return legal;
}

function sameControls(a: MarketControls, b: MarketControls): boolean {
  return (
    a.demandShift === b.demandShift &&
    a.costShift === b.costShift &&
    a.tax === b.tax &&
    a.priceCap === b.priceCap &&
    a.priceFloor === b.priceFloor &&
    a.priceSpeed === b.priceSpeed
  );
}

export function createMarket(settings: MarketSettings, seed: number): Market {
  checkSettings(settings);
  const random = createRandom(seed);
  const buyers = settings.buyers;
  const sellers = settings.sellers;

  // Draw every buyer's value, then every seller's cost, in that order.
  const baseValues = new Float64Array(buyers);
  for (let i = 0; i < buyers; i++) {
    baseValues[i] = settings.lowestValue + (settings.highestValue - settings.lowestValue) * random.next();
  }
  const baseCosts = new Float64Array(sellers);
  for (let j = 0; j < sellers; j++) {
    baseCosts[j] = settings.lowestCost + (settings.highestCost - settings.lowestCost) * random.next();
  }
  // Line buyers up from keenest to least keen and sellers from cheapest to
  // dearest. Shifts multiply everyone alike, so the line-up never changes.
  baseValues.sort().reverse();
  baseCosts.sort();

  let goingPrice = settings.startPrice;
  let period = 0;
  let boldness = 1;
  let lastCrowdedSide = 0;
  let lastControls: MarketControls | null = null;
  const lot = new Int32Array(Math.max(buyers, sellers));

  const look = (controls: MarketControls): MarketOutlook => {
    checkControls(controls);
    const price = legalPrice(goingPrice, controls);
    const sellerPrice = price - controls.tax;
    const values = new Float64Array(buyers);
    const costs = new Float64Array(sellers);
    let wanted = 0;
    for (let i = 0; i < buyers; i++) {
      values[i] = baseValues[i] * controls.demandShift;
      if (values[i] >= price) wanted++;
    }
    let offered = 0;
    for (let j = 0; j < sellers; j++) {
      costs[j] = baseCosts[j] * controls.costShift;
      if (costs[j] <= sellerPrice) offered++;
    }
    return { day: period + 1, price, sellerPrice, wanted, offered, values, costs, controls: { ...controls } };
  };

  /** Mark `served` of the first `willing` agents as TRADED, drawn by lot; the rest MISSED_OUT. */
  const drawLots = (status: Uint8Array, willing: number, served: number): void => {
    for (let k = 0; k < willing; k++) {
      lot[k] = k;
      status[k] = MISSED_OUT;
    }
    for (let k = 0; k < served; k++) {
      const pick = k + random.below(willing - k);
      const chosen = lot[pick];
      lot[pick] = lot[k];
      lot[k] = chosen;
      status[chosen] = TRADED;
    }
  };

  const advance = (controls: MarketControls): MarketDay => {
    const view = look(controls);
    const { price, sellerPrice, wanted, offered, values, costs } = view;
    const traded = Math.min(wanted, offered);

    // Willing agents are the first `wanted` buyers and first `offered` sellers,
    // because both lines are sorted. The short side all trade.
    const buyerStatus = new Uint8Array(buyers);
    const sellerStatus = new Uint8Array(sellers);
    if (wanted > traded) drawLots(buyerStatus, wanted, traded);
    else buyerStatus.fill(TRADED, 0, wanted);
    if (offered > traded) drawLots(sellerStatus, offered, traded);
    else sellerStatus.fill(TRADED, 0, offered);

    let buyerGains = 0;
    for (let i = 0; i < wanted; i++) {
      if (buyerStatus[i] === TRADED) buyerGains += values[i] - price;
    }
    let sellerGains = 0;
    for (let j = 0; j < offered; j++) {
      if (sellerStatus[j] === TRADED) sellerGains += sellerPrice - costs[j];
    }
    const taxRevenue = controls.tax * traded;

    // Overnight the price moves towards the crowded side, in proportion to how
    // lopsided the day was. A balanced day, or an empty one, leaves it alone.
    // Overshooting (a shortage one day, a glut the next) halves the boldness
    // of every later move, so the price homes in instead of hopping across the
    // balance point forever. A change in the controls is a new situation and
    // restores full boldness.
    if (lastControls === null || !sameControls(lastControls, controls)) {
      boldness = 1;
      lastCrowdedSide = 0;
    }
    lastControls = { ...controls };
    const crowdedSide = Math.sign(wanted - offered);
    if (crowdedSide !== 0) {
      if (lastCrowdedSide !== 0 && crowdedSide !== lastCrowdedSide) boldness /= 2;
      lastCrowdedSide = crowdedSide;
    }
    const turnout = wanted + offered;
    const imbalance = turnout === 0 ? 0 : (wanted - offered) / turnout;
    goingPrice = legalPrice(price * (1 + controls.priceSpeed * boldness * imbalance), controls);
    period += 1;

    return {
      ...view,
      traded,
      shortage: wanted - traded,
      surplus: offered - traded,
      buyerGains,
      sellerGains,
      taxRevenue,
      totalGains: buyerGains + sellerGains + taxRevenue,
      boldness,
      nextPrice: goingPrice,
      buyerStatus,
      sellerStatus,
    };
  };

  return {
    get period() {
      return period;
    },
    outlook: look,
    advance,
  };
}
