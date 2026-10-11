import { describe, expect, it } from "vitest";
import { textbookAnswer } from "./benchmark";

const none = { tax: 0, priceCap: null, priceFloor: null };

// A market small enough to solve by hand.
//   Buyers would pay   9, 7, 5, 3, 1
//   Sellers would take 2, 4, 6, 8, 10
// Units 1 and 2 are worth trading (9 >= 2, 7 >= 4); unit 3 is not (5 < 6).
const values = [5, 9, 1, 7, 3];
const costs = [6, 2, 10, 4, 8];

describe("the textbook answer", () => {
  it("finds where the two staircases cross", () => {
    const answer = textbookAnswer(values, costs, none);
    expect(answer.quantity).toBe(2);
    // Two buyers want it for any price above 5 up to 7; two sellers offer it from 4 up to just under 6.
    expect(answer.priceLow).toBe(5);
    expect(answer.priceHigh).toBe(6);
    expect(answer.price).toBe(5.5);
    expect(answer.binding).toBe("none");
    expect(answer.shortage).toBe(0);
    expect(answer.surplus).toBe(0);
    // (9 - 2) + (7 - 4) = 10, and nothing better exists.
    expect(answer.maxGains).toBe(10);
    expect(answer.expectedGains).toBe(10);
  });

  it("splits a tax between buyers and sellers and loses the trades it prices out", () => {
    // With a tax of 4, unit 1 still trades (9 >= 2 + 4) but unit 2 does not (7 < 4 + 4).
    const answer = textbookAnswer(values, costs, { ...none, tax: 4 });
    expect(answer.quantity).toBe(1);
    expect(answer.priceLow).toBe(7);
    expect(answer.priceHigh).toBe(8);
    expect(answer.sellerPrice).toBe(answer.price - 4);
    // Buyers pay 2 more than before, sellers keep 2 less: the tax is shared.
    expect(answer.price - 5.5).toBe(2);
    expect(5.5 - answer.sellerPrice).toBe(2);
    // Gains fall from 10 to 7: the unit that no longer trades was worth 3.
    expect(answer.expectedGains).toBe(7);
    expect(answer.maxGains).toBe(10);
  });

  it("lets a subsidy bring out trades that cost more than they are worth", () => {
    // A subsidy of 2 makes unit 3 trade (5 >= 6 - 2) at a loss of 1 to society.
    const answer = textbookAnswer(values, costs, { ...none, tax: -2 });
    expect(answer.quantity).toBe(3);
    expect(answer.expectedGains).toBe(9);
  });

  it("turns a price cap below the crossing into a shortage", () => {
    const answer = textbookAnswer(values, costs, { ...none, priceCap: 3 });
    expect(answer.binding).toBe("cap");
    expect(answer.price).toBe(3);
    // At 3, four buyers want one (9, 7, 5, 3) and one seller offers (2).
    expect(answer.wanted).toBe(4);
    expect(answer.offered).toBe(1);
    expect(answer.quantity).toBe(1);
    expect(answer.shortage).toBe(3);
    // The seller gains 1. The lucky buyer gains on average ((9+7+5+3)/4 - 3) = 3.
    expect(answer.expectedGains).toBe(4);
  });

  it("turns a price floor above the crossing into unsold goods", () => {
    const answer = textbookAnswer(values, costs, { ...none, priceFloor: 8 });
    expect(answer.binding).toBe("floor");
    expect(answer.wanted).toBe(1);
    expect(answer.offered).toBe(4);
    expect(answer.surplus).toBe(3);
    // The buyer gains 1. The lucky seller gains on average (8 - (2+4+6+8)/4) = 3.
    expect(answer.expectedGains).toBe(4);
  });

  it("ignores price rules that do not bite and keeps the price legal", () => {
    expect(textbookAnswer(values, costs, { ...none, priceCap: 20 }).binding).toBe("none");
    expect(textbookAnswer(values, costs, { ...none, priceFloor: 1 }).binding).toBe("none");
    const squeezed = textbookAnswer(values, costs, { ...none, priceCap: 5.2 });
    expect(squeezed.binding).toBe("none");
    expect(squeezed.price).toBeLessThanOrEqual(5.2);
    expect(squeezed.price).toBeGreaterThanOrEqual(5);
  });

  it("handles a market where nothing or everything trades", () => {
    const nothing = textbookAnswer([1, 2], [5, 6], none);
    expect(nothing.quantity).toBe(0);
    expect(nothing.maxGains).toBe(0);
    expect(nothing.priceLow).toBe(2);
    expect(nothing.priceHigh).toBe(5);
    const everything = textbookAnswer([9, 8], [1, 2], none);
    expect(everything.quantity).toBe(2);
    expect(everything.priceLow).toBe(2);
    expect(everything.priceHigh).toBe(8);
  });

  it("rejects an empty side or a floor above the cap", () => {
    expect(() => textbookAnswer([], costs, none)).toThrow(RangeError);
    expect(() => textbookAnswer(values, [], none)).toThrow(RangeError);
    expect(() => textbookAnswer(values, costs, { tax: 0, priceCap: 3, priceFloor: 4 })).toThrow(RangeError);
  });
});
