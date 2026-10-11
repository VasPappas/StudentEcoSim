# StudentEcoSim

A small economy that runs in the browser, for students of micro- and
macroeconomics. Many simple agents act in the engine; the textbook diagram on
screen is drawn from what they do, next to what the textbook says should happen.

Once GitHub Pages is switched on for this repository (Settings > Pages >
Source: GitHub Actions), every push to `main` publishes the app at
`https://vaspappas.github.io/StudentEcoSim/`.

## Where things stand

The economy grows one stage at a time. Each stage is finished and tried on
students before the next begins.

| Stage | What it adds | Status |
| --- | --- | --- |
| 1 | One market: buyers, sellers, a price that adjusts, taxes and price limits | First version |
| 2 | Firms: costs, entry and exit, competition against monopoly | Not started |
| 3 | The labour market and unemployment | Not started |
| 4 | The circular flow and the multiplier | Not started |
| 5 | Money, banks, the central bank and inflation | Not started |
| 6 | The government budget and debt | Not started |
| 7 | Growth | Not started |

Each stage has a one-page model card in [docs/model-cards](docs/model-cards):
its agents, its rules, what it reproduces and what it does not.

## Run it

Node 22.12 or newer.

```sh
npm install
npm run dev        # the app, at http://localhost:5173
npm run check      # types, tests and a production build
npm run sim -- --days 60 --tax 1.5 > market.csv   # the engine alone, as CSV
```

## How the code is laid out

| Folder | What lives there |
| --- | --- |
| `engine/` | The simulation: agents, markets, bookkeeping checks and the textbook benchmarks. It imports nothing from the interface and uses no browser features. |
| `app/` | The interface: diagram, controls, missions. It talks to the engine only through the three calls in [engine/core/contract.ts](engine/core/contract.ts). |
| `docs/` | Model cards and the [engine contract](docs/engine-contract.md). |
| `scripts/` | Command-line tools that run the engine without the interface. |

Three habits keep the engine easy to check and easy to port to another
language later. They are spelled out in the [engine contract](docs/engine-contract.md):

1. The model card is the specification. A rule changes there first.
2. Reference runs are stored as data and replayed exactly by the tests.
3. Randomness comes from one small, documented generator.
