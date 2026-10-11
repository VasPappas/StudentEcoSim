/**
 * The story so far: price and loaves sold, day by day, each against the
 * textbook answer for the rules in force that day. Two small charts share one
 * time axis; a table shows the same numbers for anyone who prefers to read them.
 */
import { useState } from "react";
import { euro } from "../lib/format";
import { useWidth } from "../lib/useSize";
import type { HistoryDay } from "./useMarket";

interface TrendProps {
  title: string;
  days: HistoryDay[];
  value: (day: HistoryDay) => number;
  /** The lowest and highest value the textbook accepts that day. */
  reference: (day: HistoryDay) => [number, number];
  format: (value: number) => string;
  /** True when the measure only takes whole numbers. */
  whole?: boolean;
  /** The smallest range the axis may show, so a quiet market is not blown up into drama. */
  minSpan: number;
  hover: number | null;
  onHover: (index: number | null) => void;
}

/** Three or four round numbers spanning the data. */
function roundTicks(low: number, high: number, whole: boolean): number[] {
  const span = high - low || 1;
  const rough = whole ? Math.max(1, span / 3) : span / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const multiples = whole ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const step = multiples.map((m) => m * power).find((candidate) => candidate >= rough) ?? rough;
  const ticks: number[] = [];
  for (let tick = Math.ceil(low / step) * step; tick <= high + step * 1e-9; tick += step) {
    ticks.push(Math.round(tick / step) * step);
  }
  return ticks;
}

function Trend({ title, days, value, reference, format, whole = false, minSpan, hover, onHover }: TrendProps) {
  const [frame, width] = useWidth<HTMLDivElement>(340);
  const height = 132;
  const margin = { left: 40, right: 54, top: 10, bottom: 22 };
  const plotWidth = Math.max(10, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;

  const values = days.map(value);
  const references = days.map(reference);
  let low = Math.min(...values, ...references.map(([from]) => from));
  let high = Math.max(...values, ...references.map(([, to]) => to));
  const span = Math.max(minSpan, (high - low) * 1.24);
  const middle = (low + high) / 2;
  low = middle - span / 2;
  high = middle + span / 2;
  const ticks = roundTicks(low, high, whole);

  const x = (index: number) => margin.left + (days.length <= 1 ? 0.5 : index / (days.length - 1)) * plotWidth;
  const y = (amount: number) => margin.top + (1 - (amount - low) / (high - low)) * plotHeight;
  const line = values.map((amount, k) => `${k === 0 ? "M" : "L"}${x(k).toFixed(1)},${y(amount).toFixed(1)}`).join("");
  // The textbook answer is a band: one block per day, at least a highlighter's width tall.
  const half = days.length <= 1 ? plotWidth / 2 : plotWidth / (days.length - 1) / 2;
  const band = references.map(([from, to], k) => {
    const left = Math.max(margin.left, x(k) - half);
    const right = Math.min(margin.left + plotWidth, x(k) + half);
    const top = Math.min(y(to), y((from + to) / 2) - 3.5);
    const bottom = Math.max(y(from), y((from + to) / 2) + 3.5);
    return { left, width: right - left, top, height: bottom - top };
  });
  const inWords = ([from, to]: [number, number]) =>
    format(from) === format(to) ? format(from) : `${format(from)} to ${format(to)}`;
  const last = days.length - 1;
  const shown = hover !== null && hover <= last ? hover : last;

  return (
    <figure className="trend" ref={frame}>
      <figcaption>
        <span>{title}</span>
        <strong>{format(values[shown])}</strong>
      </figcaption>
      <svg width={width} height={height} role="img"
        aria-label={`${title} by day. Latest: ${format(values[last])}; textbook: ${inWords(references[last])}.`}>
        <g className="grid">
          {ticks.map((tick) => (
            <line key={tick} x1={margin.left} x2={margin.left + plotWidth} y1={y(tick)} y2={y(tick)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((tick) => (
            <text key={tick} x={margin.left - 7} y={y(tick) + 4} textAnchor="end">{format(tick)}</text>
          ))}
          <text x={margin.left} y={height - 5}>day {days[0].day}</text>
          {days.length > 1 && (
            <text x={margin.left + plotWidth} y={height - 5} textAnchor="end">day {days[last].day}</text>
          )}
        </g>
        <g className="reference">
          {band.map((block, k) => (
            <rect key={k} x={block.left} width={block.width + 0.5} y={block.top} height={block.height} />
          ))}
        </g>
        <path className="series" d={line} />
        {hover !== null && hover <= last && (
          <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + plotHeight} />
        )}
        <circle className="end-dot" cx={x(shown)} cy={y(values[shown])} r={4.5} />
        {hover === null && (
          <text className="end-label" x={x(last) + 9} y={y(values[last]) + 4}>{format(values[last])}</text>
        )}
        <rect className="hit" x={margin.left - 6} y={0} width={plotWidth + 12} height={height}
          onPointerMove={(event) => {
            const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
            const share = (event.clientX - box.left - margin.left) / plotWidth;
            onHover(Math.min(last, Math.max(0, Math.round(share * last))));
          }}
          onPointerLeave={() => onHover(null)}
        />
      </svg>
    </figure>
  );
}

export function History({ days }: { days: HistoryDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  if (days.length === 0) {
    return <p className="history-empty">Nothing has traded yet. Each day you run adds a point here.</p>;
  }
  const pointed = hover !== null && hover < days.length ? days[hover] : null;

  return (
    <section className="history" aria-label="Day by day">
      <div className="history-head">
        {asTable ? (
          <p className="readout">The last {Math.min(60, days.length)} days, newest first.</p>
        ) : (
          <ul className="key">
            <li><span className="swatch line" />your market</li>
            <li><span className="swatch reference" />textbook answer</li>
          </ul>
        )}
        <button type="button" className="quiet" aria-pressed={asTable} onClick={() => setAsTable(!asTable)}>
          {asTable ? "Show charts" : "Show table"}
        </button>
      </div>
      {asTable ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Day</th><th>Price</th><th>Wanted</th><th>Offered</th><th>Sold</th><th>Textbook price</th><th>Textbook sold</th></tr>
            </thead>
            <tbody>
              {days.slice(-60).reverse().map((day) => (
                <tr key={day.day}>
                  <td>{day.day}</td><td>{euro(day.price)}</td><td>{day.wanted}</td><td>{day.offered}</td>
                  <td>{day.traded}</td>
                  <td>{euro(day.textbookLow) === euro(day.textbookHigh) ? euro(day.textbookLow) : `${euro(day.textbookLow)} to ${euro(day.textbookHigh)}`}</td>
                  <td>{day.textbookQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="trends">
            <Trend title="Price" days={days} value={(day) => day.price} reference={(day) => [day.textbookLow, day.textbookHigh]}
              format={euro} minSpan={1} hover={hover} onHover={setHover} />
            <Trend title="Loaves sold" days={days} value={(day) => day.traded} reference={(day) => [day.textbookQuantity, day.textbookQuantity]}
              format={(amount) => String(Math.round(amount))} whole minSpan={12} hover={hover} onHover={setHover} />
          </div>
          <p className="readout" aria-live="off">
            {pointed
              ? `Day ${pointed.day}: price ${euro(pointed.price)}, ${pointed.wanted} wanted, ${pointed.offered} offered, ${pointed.traded} sold.`
              : "Point at a chart to read off any day."}
          </p>
        </>
      )}
    </section>
  );
}
