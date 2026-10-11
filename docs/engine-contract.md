# Engine contract

The rules every stage's engine follows, so that it can be tested in isolation,
run without the interface, and rewritten in another language without changing
a single result.

## A narrow interface

A stage offers one `create…(settings, seed)` function that returns a
`Simulation` ([engine/core/contract.ts](../engine/core/contract.ts)). The
interface may ask it exactly three things:

| Call | What it does |
| --- | --- |
| `outlook(controls)` | Describes the coming period under these controls. Changes nothing. |
| `advance(controls)` | Runs one period and returns what happened. |
| `period` | How many periods have run. |

Nothing else crosses the boundary. The interface never reaches into the
engine's state, and the engine knows nothing about the interface.
`tsconfig.engine.json` compiles the engine without browser or Node types, and
`tests/boundaries.test.ts` fails if an engine file imports anything outside
`engine/`.

## Rules for engine code

- **Agent data lives in flat arrays** (`Float64Array`, `Uint8Array`), one
  entry per agent, not in one object per agent.
- **Only `+ - * /` and comparisons on doubles** in anything that affects
  results. These give identical answers in every language. Functions such as
  `exp`, `log` and `pow` can differ in the last digit between platforms, so
  they stay out.
- **Sums run in index order.** No reordering, no compensated summation.
- **All randomness comes from the generator below**, drawn in a documented
  order.
- **Every period is checked.** Each stage has a bookkeeping check that
  recounts the period from the per-agent record: every unit bought was sold,
  and every payment has a payer and a receiver.
- **Each stage has an independent benchmark**: the textbook answer computed
  directly, sharing no code with the simulation.

## The random generator

`createRandom(seed)` in [engine/core/random.ts](../engine/core/random.ts) is
mulberry32. The seed is a whole number from 0 to 4294967295. All arithmetic is
on unsigned 32-bit integers, wrapping on overflow.

```text
state = seed

nextUint32():
    state = (state + 0x6D2B79F5) mod 2^32
    t = state
    t = (t XOR (t >> 15)) * (t OR 1)            mod 2^32
    t = t XOR (t + (t XOR (t >> 7)) * (t OR 61)) mod 2^32
    return t XOR (t >> 14)

next():   nextUint32() / 2^32            a double in [0, 1)
below(n): floor(next() * n)              a whole number in [0, n)
```

`>>` is a logical (zero-filling) right shift. Reference outputs for seed
`20261011` are stored under `random` in
[engine/testdata/market-golden.json](../engine/testdata/market-golden.json).

## Reference runs

`engine/testdata/market-golden.json` records one market taken through every
rule in turn: the settings, the seed, the timetable of controls, every agent's
value and cost, and the outcome of each day. The tests replay it and require
identical numbers. Decimals are IEEE 754 doubles written with the shortest
text that reads back to the same value, so the comparison is exact, not
"close".

A version of the engine in another language is correct when it reproduces
this file.

To regenerate it after an intended rule change:

```sh
npm run golden
```

A diff in the golden file is a change in the model. It belongs in the same
commit as the change to the model card.

## Running without the interface

```sh
npm run sim -- --days 60 --seed 2 --tax 1.5 --cap 3 > market.csv
```

Options: `--days --seed --demand --costs --tax --cap --floor --speed --start`.
The output has one row per day and can be analysed in any tool.
