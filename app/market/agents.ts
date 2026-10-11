/**
 * One plain sentence for any buyer or seller: what they are worth, what they
 * did today and why. This is what a student reads when they click an agent.
 */
import { MISSED_OUT, TRADED, type MarketDay, type MarketOutlook, type TextbookAnswer } from "../../engine/market";
import { euro } from "../lib/format";

export type Side = "buyer" | "seller";

export interface AgentRef {
  side: Side;
  /** Position in the line-up, counting from 0. */
  index: number;
}

export function isTraded(view: MarketOutlook | MarketDay): view is MarketDay {
  return "buyerStatus" in view;
}

export function agentTitle(agent: AgentRef): string {
  return `${agent.side === "buyer" ? "Buyer" : "Seller"} ${agent.index + 1}`;
}

export function describeAgent(agent: AgentRef, view: MarketOutlook | MarketDay): string {
  const { price, sellerPrice } = view;
  const tax = view.controls.tax;
  const done = isTraded(view);

  if (agent.side === "buyer") {
    const value = view.values[agent.index];
    const willing = value >= price;
    const opening = `Would pay up to ${euro(value)} for a loaf.`;
    if (!willing) {
      return `${opening} At ${euro(price)} it is not worth it to them, so they ${done ? "stayed" : "will stay"} home.`;
    }
    if (!done) return `${opening} At ${euro(price)} that is a good deal, so they plan to buy.`;
    if (view.buyerStatus[agent.index] === TRADED) {
      return `${opening} They bought at ${euro(price)} and came out ${euro(value - price)} ahead.`;
    }
    return `${opening} They wanted one at ${euro(price)}, but the bread ran out before their turn.`;
  }

  const cost = view.costs[agent.index];
  const willing = cost <= sellerPrice;
  const opening = `Needs at least ${euro(cost)} to make a loaf worth selling.`;
  const keeps =
    tax > 0
      ? `they keep ${euro(sellerPrice)} of the ${euro(price)} price after tax`
      : tax < 0
        ? `they get ${euro(sellerPrice)} per loaf with the subsidy`
        : `the price is ${euro(price)}`;
  if (!willing) {
    return `${opening} Today ${keeps}, which does not cover it, so they ${done ? "did" : "will"} not bake.`;
  }
  if (!done) return `${opening} Today ${keeps}, so they plan to sell.`;
  if (view.sellerStatus[agent.index] === TRADED) {
    return `${opening} Today ${keeps}; they sold and came out ${euro(sellerPrice - cost)} ahead.`;
  }
  if (view.sellerStatus[agent.index] === MISSED_OUT) {
    return `${opening} Today ${keeps}; they brought a loaf but found no buyer.`;
  }
  return opening;
}

/**
 * The textbook price in words. With a hundred people a side, a small range of
 * prices balances the market, so the answer is a range unless a legal limit
 * pins it or the range is under a cent wide.
 */
export function textbookPriceText(answer: TextbookAnswer): string {
  if (answer.binding !== "none") return `at ${euro(answer.price)}`;
  const low = euro(answer.priceLow);
  const high = euro(answer.priceHigh);
  return low === high ? `at ${low}` : `at ${low} to ${high}`;
}
