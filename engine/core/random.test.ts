import { describe, expect, it } from "vitest";
import golden from "../testdata/market-golden.json";
import { createRandom } from "./random";

describe("seeded random numbers", () => {
  it("reproduces the stored reference outputs", () => {
    const random = createRandom(golden.random.seed);
    const values = golden.random.firstUint32.map(() => random.nextUint32());
    expect(values).toEqual(golden.random.firstUint32);
  });

  it("gives the same sequence for the same seed and a different one otherwise", () => {
    const first = createRandom(7);
    const again = createRandom(7);
    const other = createRandom(8);
    const a = Array.from({ length: 20 }, () => first.next());
    const b = Array.from({ length: 20 }, () => again.next());
    const c = Array.from({ length: 20 }, () => other.next());
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it("stays inside its ranges and covers them evenly", () => {
    const random = createRandom(123);
    const counts = new Array<number>(10).fill(0);
    for (let k = 0; k < 100000; k++) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      counts[random.below(10)]++;
    }
    for (const count of counts) expect(Math.abs(count - 10000)).toBeLessThan(400);
  });

  it("rejects seeds and ranges it cannot honour", () => {
    for (const seed of [-1, 1.5, 2 ** 32, Number.NaN]) expect(() => createRandom(seed)).toThrow(RangeError);
    for (const n of [0, -3, 2.5]) expect(() => createRandom(1).below(n)).toThrow(RangeError);
  });
});
