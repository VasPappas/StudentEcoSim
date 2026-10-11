/**
 * Seeded random numbers: the mulberry32 generator.
 *
 * Runs must be repeatable, and the browser's own generator cannot be seeded.
 * This one uses only 32-bit integer steps, so a version in another language
 * can reproduce every run exactly. The full recipe and reference outputs are
 * in docs/engine-contract.md.
 */
export interface Random {
  /** The next raw value: a whole number from 0 to 2^32 - 1. */
  nextUint32(): number;
  /** A number in [0, 1): nextUint32() divided by 2^32. */
  next(): number;
  /** A whole number in [0, n): floor(next() * n). */
  below(n: number): number;
}

export function createRandom(seed: number): Random {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError("The seed must be a whole number from 0 to 4294967295.");
  }
  let state = seed >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const next = (): number => nextUint32() / 4294967296;
  const below = (n: number): number => {
    if (!Number.isInteger(n) || n < 1) {
      throw new RangeError("below(n) needs a whole number of at least 1.");
    }
    return Math.floor(next() * n);
  };

  return { nextUint32, next, below };
}
