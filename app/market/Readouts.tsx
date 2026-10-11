/** The day in numbers: three headline figures, then who gained what from trading. */
import type { MarketDay, MarketOutlook, TextbookAnswer } from "../../engine/market";
import { euro, euroTotal, percent } from "../lib/format";
import { isTraded } from "./agents";

interface ReadoutsProps {
  view: MarketOutlook | MarketDay;
  textbook: TextbookAnswer;
}

export function Readouts({ view, textbook }: ReadoutsProps) {
  const done = isTraded(view);
  const { price, sellerPrice, wanted, offered, controls } = view;

  let priceNote = "the plan for this day";
  if (controls.tax !== 0) priceNote = `sellers keep ${euro(sellerPrice)}`;
  else if (done && view.nextPrice > view.price) priceNote = `rising to ${euro(view.nextPrice)} tomorrow`;
  else if (done && view.nextPrice < view.price) priceNote = `falling to ${euro(view.nextPrice)} tomorrow`;
  else if (done) priceNote = "holding steady";

  const short = wanted - offered;
  const crowdLabel = short > 0 ? "Buyers left without" : short < 0 ? "Loaves left unsold" : "Left out";
  const crowdNote =
    short > 0 ? "more buyers than loaves" : short < 0 ? "more loaves than buyers" : "everyone willing gets to trade";

  return (
    <>
      <dl className="readouts">
        <div>
          <dt>{done ? `Price on day ${view.day}` : `Price for day ${view.day}`}</dt>
          <dd>{euro(price)}</dd>
          <p>{priceNote}</p>
        </div>
        <div>
          <dt>Loaves sold</dt>
          <dd>{done ? view.traded : "–"}</dd>
          <p>{wanted} wanted, {offered} offered</p>
        </div>
        <div>
          <dt>{crowdLabel}</dt>
          <dd>{Math.abs(short)}</dd>
          <p>{crowdNote}</p>
        </div>
      </dl>
      <Gains view={view} best={textbook.maxGains} />
    </>
  );
}

/**
 * Gains from trade, spelled out: one bar the length of the most this town
 * could gain, cut into who got it and what was lost.
 */
function Gains({ view, best }: { view: MarketOutlook | MarketDay; best: number }) {
  const meaning =
    "How much better off the town is for trading: what each buyer and each seller came out ahead by, added together.";

  if (!isTraded(view)) {
    return (
      <section className="gains-panel" aria-label="Gains from trade">
        <header>
          <h2>Gains from trade</h2>
        </header>
        <p className="meaning">{meaning}</p>
        <p className="meaning">
          Nothing has traded under these rules yet. At best, these buyers and sellers can gain {euroTotal(best)} a day.
        </p>
      </section>
    );
  }

  const { buyerGains, sellerGains, taxRevenue, totalGains } = view;
  const subsidy = taxRevenue < 0;
  const councilNote =
    taxRevenue > 0
      ? " The tax the council collects counts too: the town still has that money."
      : subsidy
        ? " The subsidy the council pays out is taken off: the town has to find that money."
        : "";
  const lost = Math.max(0, best - totalGains);
  const nothingLost = lost < 0.005;
  // With a tax or no intervention the pieces add up to the best possible. A subsidy pays
  // traders more than the town gains, so there the bar shows only what the traders got.
  const pieces = [
    { key: "buyers", amount: buyerGains },
    { key: "sellers", amount: sellerGains },
    { key: "council", amount: subsidy ? 0 : taxRevenue },
    { key: "lost", amount: subsidy || nothingLost ? 0 : lost },
  ].filter((piece) => piece.amount > 0);
  const whole = pieces.reduce((sum, piece) => sum + piece.amount, 0);

  return (
    <section className="gains-panel" aria-label="Gains from trade">
      <header>
        <h2>Gains from trade</h2>
        <p className="total">
          <strong>{euroTotal(totalGains)}</strong> today
          {best > 0 && <span>{percent(Math.max(0, totalGains / best))} of the best possible</span>}
        </p>
      </header>
      <p className="meaning">{meaning}{councilNote}</p>

      {whole > 0 && (
        <div className="gains-bar" aria-hidden="true">
          {pieces.map((piece) => (
            <span key={piece.key} className={piece.key} style={{ flexGrow: piece.amount, flexBasis: 0 }} />
          ))}
        </div>
      )}

      <dl className="gains-list">
        <div>
          <dt><span className="swatch demand" />Buyers</dt>
          <dd>{euroTotal(buyerGains)}</dd>
          <p>A loaf was worth this much more to them than the price they paid.</p>
        </div>
        <div>
          <dt><span className="swatch supply" />Sellers</dt>
          <dd>{euroTotal(sellerGains)}</dd>
          <p>They were paid this much more than their loaves cost to make.</p>
        </div>
        {taxRevenue !== 0 && (
          <div>
            <dt><span className="swatch council" />Council</dt>
            <dd>{subsidy ? `−${euroTotal(-taxRevenue)}` : euroTotal(taxRevenue)}</dd>
            <p>{subsidy ? "Paid out in subsidy, which the town has to fund." : "Collected in tax."}</p>
          </div>
        )}
        <div>
          <dt><span className="swatch lost" />Lost</dt>
          <dd>{nothingLost ? euro(0) : euroTotal(lost)}</dd>
          <p>
            {nothingLost
              ? `Nothing. ${euroTotal(best)} a day is the most these buyers and sellers can gain.`
              : `Gains this town could have had. The best possible is ${euroTotal(best)} a day.`}
          </p>
        </div>
      </dl>
      <p className="meaning">
        In the diagram these are the shaded bars: blue for buyers, orange for sellers. Your textbook calls them
        consumer surplus and producer surplus.
      </p>
    </section>
  );
}
