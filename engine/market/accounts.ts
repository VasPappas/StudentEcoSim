/**
 * Independent checks on one traded day.
 *
 * Every unit bought was sold, every euro paid was received by a seller or the
 * tax office, and nobody traded against their own interest. The checks recount
 * everything from the per-agent record instead of trusting the day's totals.
 */
import { legalPrice, MISSED_OUT, STAYED_OUT, TRADED, type MarketDay } from "./market";

const close = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Returns one sentence per problem found; an empty list means the day balances. */
export function checkDay(day: MarketDay): string[] {
  const problems: string[] = [];
  const { price, sellerPrice, controls } = day;

  if (!close(sellerPrice, price - controls.tax)) problems.push("Sellers do not keep the price less the tax.");
  if (legalPrice(price, controls) !== price) problems.push("The price breaks the legal cap or floor.");

  let bought = 0;
  let wanted = 0;
  let buyerGains = 0;
  day.buyerStatus.forEach((status, i) => {
    const value = day.values[i];
    const willing = value >= price;
    if (willing) wanted++;
    if (status === TRADED) {
      bought++;
      buyerGains += value - price;
      if (!willing) problems.push(`Buyer ${i} paid more than the bread is worth to them.`);
    } else if (status === MISSED_OUT && !willing) {
      problems.push(`Buyer ${i} is recorded as missing out but did not want to buy.`);
    } else if (status === STAYED_OUT && willing) {
      problems.push(`Buyer ${i} wanted to buy but is recorded as staying out.`);
    }
  });

  let sold = 0;
  let offered = 0;
  let sellerGains = 0;
  day.sellerStatus.forEach((status, j) => {
    const cost = day.costs[j];
    const willing = cost <= sellerPrice;
    if (willing) offered++;
    if (status === TRADED) {
      sold++;
      sellerGains += sellerPrice - cost;
      if (!willing) problems.push(`Seller ${j} sold for less than their cost.`);
    } else if (status === MISSED_OUT && !willing) {
      problems.push(`Seller ${j} is recorded as missing out but did not want to sell.`);
    } else if (status === STAYED_OUT && willing) {
      problems.push(`Seller ${j} wanted to sell but is recorded as staying out.`);
    }
  });

  if (bought !== sold) problems.push("Units bought and units sold differ.");
  if (bought !== day.traded) problems.push("The traded total does not match the buyers who bought.");
  if (wanted !== day.wanted || offered !== day.offered) problems.push("The willing counts do not match the agents.");
  if (day.traded !== Math.min(wanted, offered)) problems.push("The short side of the market did not all trade.");
  if (day.shortage !== wanted - bought || day.surplus !== offered - sold) {
    problems.push("Shortage or surplus does not match the agents left over.");
  }

  // Money: what buyers hand over equals what sellers keep plus the tax.
  const paid = bought * price;
  const received = sold * sellerPrice;
  const tax = controls.tax * day.traded;
  if (!close(paid, received + tax)) problems.push("Money paid does not equal money received plus tax.");
  if (!close(day.taxRevenue, tax)) problems.push("Tax revenue does not match the units traded.");
  if (!close(day.buyerGains, buyerGains)) problems.push("Buyers' gains do not add up.");
  if (!close(day.sellerGains, sellerGains)) problems.push("Sellers' gains do not add up.");
  if (!close(day.totalGains, buyerGains + sellerGains + tax)) problems.push("Total gains do not add up.");
  if (buyerGains < -1e-9 || sellerGains < -1e-9) problems.push("A group lost out by trading.");

  return problems;
}
