/**
 * Missions: a short story, a prediction, then the market answers.
 *
 * Nothing here is scripted. The right answer to each question is read off
 * what the simulated market actually did, so a mission stays honest if the
 * engine's rules change.
 */
import type { MarketControls, MarketDay } from "../../engine/market";
import { euro, euroTotal, plural } from "../lib/format";

export interface Choice {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  prompt: string;
  choices: Choice[];
  /** What happened, as the id of one of the choices. */
  outcome(before: MarketDay, after: MarketDay): string;
  /** One sentence saying what happened, with the numbers. */
  report(before: MarketDay, after: MarketDay): string;
}

export interface Mission {
  id: string;
  title: string;
  story: string;
  /** "low": the price opens well below balance. "settled": the market starts at rest. */
  start: "low" | "settled";
  /** The change this mission makes, given the price the market rests at. */
  change(restingPrice: number): Partial<MarketControls>;
  questions: Question[];
  /** What to take away, written after the market has answered. */
  lesson(before: MarketDay, after: MarketDay): string;
}

/** The opening price for missions that start away from balance. */
export const LOW_START_PRICE = 2;

type Direction = "up" | "down" | "same";

function direction(before: number, after: number, tolerance: number): Direction {
  if (after > before + tolerance) return "up";
  if (after < before - tolerance) return "down";
  return "same";
}

const moved: Record<Direction, string> = { up: "rose", down: "fell", same: "stayed" };

const priceQuestion: Question = {
  id: "price",
  prompt: "What will happen to the price?",
  choices: [
    { id: "up", label: "It rises" },
    { id: "down", label: "It falls" },
    { id: "same", label: "It stays the same" },
  ],
  outcome: (before, after) => direction(before.price, after.price, 0.005),
  report: (before, after) => {
    const way = direction(before.price, after.price, 0.005);
    return way === "same"
      ? `The price stayed at ${euro(after.price)}.`
      : `The price ${moved[way]} from ${euro(before.price)} to ${euro(after.price)}.`;
  },
};

const soldQuestion: Question = {
  id: "sold",
  prompt: "And the number of loaves sold each day?",
  choices: [
    { id: "up", label: "More are sold" },
    { id: "down", label: "Fewer are sold" },
    { id: "same", label: "The same number" },
  ],
  outcome: (before, after) => direction(before.traded, after.traded, 0),
  report: (before, after) => {
    const way = direction(before.traded, after.traded, 0);
    return way === "same"
      ? `Loaves sold stayed at ${after.traded} a day.`
      : `Loaves sold ${moved[way]} from ${before.traded} to ${after.traded} a day.`;
  },
};

function crowd(day: MarketDay): "shortage" | "glut" | "balanced" {
  if (day.shortage > 0) return "shortage";
  if (day.surplus > 0) return "glut";
  return "balanced";
}

const crowdChoices: Choice[] = [
  { id: "shortage", label: "More buyers than loaves" },
  { id: "glut", label: "More loaves than buyers" },
  { id: "balanced", label: "The two match" },
];

function crowdReport(day: MarketDay): string {
  const buyers = plural(day.wanted, "buyer", "buyers");
  const sellers = plural(day.offered, "seller", "sellers");
  const verb = day.offered === 1 ? "offers" : "offer";
  if (day.shortage > 0) {
    return `At ${euro(day.price)}, ${buyers} want a loaf but only ${sellers} ${verb} one: ${day.shortage} go without.`;
  }
  if (day.surplus > 0) {
    return `At ${euro(day.price)}, ${sellers} ${verb} a loaf but only ${buyers} want one: ${day.surplus} go unsold.`;
  }
  return `At ${euro(day.price)}, ${buyers} want a loaf and ${sellers} ${verb} one.`;
}

/** A cap one euro under the resting price, on a round ten cents. */
function capFor(restingPrice: number): number {
  return Math.max(0.5, Math.round((restingPrice - 1) * 10) / 10);
}

export const BREAD_TAX = 1.5;

export const missions: Mission[] = [
  {
    id: "find-the-price",
    title: "Find the price",
    story:
      "It is the market's first day and nobody knows what bread is worth. The going price opens at " +
      `${euro(LOW_START_PRICE)}, which is cheap.`,
    start: "low",
    change: () => ({}),
    questions: [
      {
        id: "first-day",
        prompt: `At ${euro(LOW_START_PRICE)}, what will day 1 look like?`,
        choices: crowdChoices,
        outcome: (before) => crowd(before),
        report: (before) => `Day 1: ${crowdReport(before)}`,
      },
      {
        id: "settles",
        prompt: "Where will the price end up?",
        choices: [
          { id: "up", label: `Above ${euro(LOW_START_PRICE)}` },
          { id: "down", label: `Below ${euro(LOW_START_PRICE)}` },
          { id: "same", label: `It stays at ${euro(LOW_START_PRICE)}` },
        ],
        outcome: (before, after) => direction(before.price, after.price, 0.005),
        report: (_before, after) =>
          `The price came to rest at ${euro(after.price)} after ${after.day} days, with ${after.traded} loaves sold a day.`,
      },
    ],
    lesson: (_before, after) =>
      "A price that is too low leaves buyers competing for too few loaves, and that pulls the price up. " +
      "It stops at the one price where as many people want to buy as want to sell. " +
      `Your textbook calls that the equilibrium: here ${euro(after.price)} and ${after.traded} loaves.`,
  },
  {
    id: "festival",
    title: "Festival weekend",
    story: "A festival fills the town. Every buyer now values a loaf 30% more than before. Sellers' costs are unchanged.",
    start: "settled",
    change: () => ({ demandShift: 1.3 }),
    questions: [priceQuestion, soldQuestion],
    lesson: (before, after) =>
      "Demand rose: at any price, more people want bread. The old price left a shortage, so the price climbed " +
      `until it had put off some buyers and drawn in ${Math.max(0, after.traded - before.traded)} more sellers. ` +
      "More demand means a higher price and more sold.",
  },
  {
    id: "flour",
    title: "Flour gets dearer",
    story: "A poor harvest pushes up the price of flour. Every seller's cost of making a loaf rises by 30%. Buyers are unchanged.",
    start: "settled",
    change: () => ({ costShift: 1.3 }),
    questions: [priceQuestion, soldQuestion],
    lesson: (before, after) =>
      "Supply fell: at any price, fewer sellers find it worth baking. " +
      `The price rose by ${euro(after.price - before.price)}, less than most sellers' costs did, ` +
      "because buyers who would not pay more dropped out. Higher costs mean a higher price and fewer sold.",
  },
  {
    id: "price-cap",
    title: "The council caps the price",
    story: "Bread feels expensive, so the council makes it illegal to charge more than a set price, one euro below today's.",
    start: "settled",
    change: (restingPrice) => ({ priceCap: capFor(restingPrice) }),
    questions: [
      {
        id: "crowd",
        prompt: "What will the cap cause?",
        choices: crowdChoices,
        outcome: (_before, after) => crowd(after),
        report: (_before, after) => crowdReport(after),
      },
      soldQuestion,
    ],
    lesson: (before, after) =>
      "Held below its resting point, the price cannot rise to clear the queue. More people want bread, fewer " +
      "sellers bake, and who gets a loaf is down to luck. Those who do get one pay less, but the gains from trade " +
      `shrank from ${euroTotal(before.totalGains)} to ${euroTotal(after.totalGains)} a day.`,
  },
  {
    id: "bread-tax",
    title: "A tax on bread",
    story: `The council puts a tax of ${euro(BREAD_TAX)} on every loaf. Sellers hand it over out of the price buyers pay.`,
    start: "settled",
    change: () => ({ tax: BREAD_TAX }),
    questions: [
      {
        id: "burden",
        prompt: "By how much will the price buyers pay rise?",
        choices: [
          { id: "less", label: `Less than ${euro(BREAD_TAX)}` },
          { id: "exact", label: `Exactly ${euro(BREAD_TAX)}` },
          { id: "more", label: `More than ${euro(BREAD_TAX)}` },
        ],
        outcome: (before, after) => {
          const rise = after.price - before.price;
          if (rise < BREAD_TAX - 0.02) return "less";
          if (rise > BREAD_TAX + 0.02) return "more";
          return "exact";
        },
        report: (before, after) =>
          `Buyers pay ${euro(after.price - before.price)} more and sellers keep ` +
          `${euro(before.sellerPrice - after.sellerPrice)} less. Together that is the ${euro(BREAD_TAX)} tax.`,
      },
      soldQuestion,
    ],
    lesson: (before, after) =>
      "A tax drives a wedge between what buyers pay and what sellers keep, and both sides bear part of it, " +
      `whoever hands over the money. The council collects ${euroTotal(after.taxRevenue)} a day, but ` +
      `${plural(Math.max(0, before.traded - after.traded), "trade", "trades")} worth making no longer happen: ` +
      `${euroTotal(before.totalGains - after.totalGains)} a day of gains is simply lost.`,
  },
];
