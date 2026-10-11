/** The four numbers worth watching, in words a student would use. */
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

  const share = done && textbook.maxGains > 0 ? Math.max(0, Math.min(1, view.totalGains / textbook.maxGains)) : 0;

  return (
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
      <div>
        <dt>Gains from trade</dt>
        <dd>{done ? euroTotal(view.totalGains) : "–"}</dd>
        {done ? (
          <>
            <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}
              aria-label="Share of the largest possible gains">
              <span style={{ width: `${share * 100}%` }} />
            </div>
            <p>
              {percent(share)} of the most this town could gain. Buyers {euroTotal(view.buyerGains)}, sellers{" "}
              {euroTotal(view.sellerGains)}
              {controls.tax !== 0 ? `, ${controls.tax > 0 ? "tax" : "subsidy"} ${euroTotal(Math.abs(view.taxRevenue))}` : ""}.
            </p>
          </>
        ) : (
          <p>what buyers and sellers gain by trading</p>
        )}
      </div>
    </dl>
  );
}
