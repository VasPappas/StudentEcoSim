# Stage 1: one market

Model card for the engine in [engine/market](../../engine/market). This page
is the specification: a rule changes here first, then in the code.

## What it is for

The first chapters of a microeconomics course: demand, supply, equilibrium,
shortages and gluts, shifts in demand and supply, taxes and subsidies, price
ceilings and floors, and the gains from trade.

## Who is in it

| Agent | How many | What they know | What they do |
| --- | --- | --- | --- |
| Buyer | 100 | Their own value: the most they would pay for one loaf | Wants one loaf a day if the price is at or below their value |
| Seller | 100 | Their own cost: the least they would accept for one loaf | Offers one loaf a day if what they keep is at or above their cost |

Values and costs are drawn once, evenly between €1 and €7, from the seeded
generator: all buyers first, then all sellers. Nobody knows anyone else's
number. There is no money stock, no saving and no production decision yet.

## What happens each day

1. Everyone sees the going price. Buyers pay it. Sellers keep the price less
   any tax (or plus any subsidy).
2. Buyers whose value is at least the price turn up to buy. Sellers whose cost
   is at most what they keep turn up to sell.
3. The smaller group all trade. In the larger group, lots are drawn for who
   gets to trade; the rest go home empty-handed.
4. Overnight the going price moves towards the crowded side:

   ```text
   imbalance  = (willing buyers - willing sellers) / (willing buyers + willing sellers)
   next price = price * (1 + speed * boldness * imbalance)
   ```

   A balanced day leaves the price where it is.
5. Boldness starts at 1. Each time a shortage is followed by a glut, or a glut
   by a shortage, boldness halves, so the price homes in instead of hopping
   across the balance point. Any change in the controls resets it to 1.
6. A legal maximum or minimum price, if set, is applied to the going price
   before each day: the floor first, then the cap.

## What a student can change

| Control | Meaning | Range in the app |
| --- | --- | --- |
| Demand shift | Multiplies every buyer's value | -40% to +40% |
| Cost shift | Multiplies every seller's cost | -40% to +40% |
| Tax per loaf | Taken out of the price buyers pay; negative is a subsidy | -€1 to €3 |
| Legal price limit | A maximum or a minimum price | €1 to €8 |
| Price speed | How strongly the price reacts to a lopsided day | 0.15, 0.35 or 0.9 |

## The textbook answer it is compared with

[benchmark.ts](../../engine/market/benchmark.ts) sorts the values from high to
low and the costs from low to high and finds where the two staircases cross.
That gives the quantity traded and the range of prices that balance the
market. With 100 people a side that range is a few cents wide; the smooth
curves of a textbook shrink it to a point. The benchmark also gives the
shortage or glut under a binding price limit, and the largest gains from
trade these people could reach. It shares no code with the simulation.

## What it reproduces

Each line is enforced by a test, in several different towns (seeds).

- The price settles inside the textbook's range and the quantity matches
  exactly, with or without a demand shift, a cost shift, a tax or a subsidy.
- Left alone, the market captures every possible gain from trade.
- A price that opens too low produces a shortage and rises; too high, a glut
  and falls.
- More demand: higher price, more sold. Higher costs: higher price, fewer sold.
- A price cap below the balance point causes a lasting shortage and fewer
  sales; a floor above it causes unsold goods. Both shrink the gains from
  trade.
- A tax raises what buyers pay by less than the tax, lowers what sellers keep,
  and loses the trades it prices out.
- Every day's books balance: units bought equal units sold, money paid equals
  money received plus tax, and nobody trades against their own interest.

## What it does not do

- **Nobody sets the price.** The going price moves by a rule, as in the
  textbook story of a price that responds to excess demand. No seller chooses
  it. Sellers who post their own prices come with firms in stage 2.
- **One unit each.** There are no budgets, no incomes and no choice of how
  much to buy or make.
- **Rationing is by lot.** Under a price cap the loaves do not go to those who
  value them most, which is one of the costs of a cap. Queues, favouritism and
  resale are not modelled.
- **No expectations.** Nobody plans for tomorrow.
- **Days are identical.** Unsold bread is not carried over, and nothing
  accumulates.

## Background

That very simple traders can reach the competitive outcome is an old
experimental finding: Smith, "An Experimental Study of Competitive Market
Behavior", *Journal of Political Economy* (1962), and Gode and Sunder,
"Allocative Efficiency of Markets with Zero-Intelligence Traders", *Journal of
Political Economy* (1993). The price rule here is not taken from those papers.
It is the simplest rule that moves the price towards the crowded side and is
guaranteed to settle.
