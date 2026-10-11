/**
 * The supply-and-demand diagram, drawn from the agents themselves.
 *
 * Every dot is one buyer or one seller. Buyers stand in line from keenest to
 * least keen, sellers from cheapest to dearest, so the two lines of dots are
 * the demand and supply curves of the textbook. Filled dots traded today,
 * rings wanted to but missed out, faint dots stayed away.
 */
import { useMemo, useState, type KeyboardEvent } from "react";
import { MISSED_OUT, TRADED, type MarketDay, type MarketOutlook, type TextbookAnswer } from "../../engine/market";
import { euro } from "../lib/format";
import { useWidth } from "../lib/useSize";
import { agentTitle, describeAgent, isTraded, textbookPriceText, type AgentRef } from "./agents";

/** The price axis is fixed so that shifts are seen as the curves moving, not the labels. */
const TOP_PRICE = 10;

interface DiagramProps {
  view: MarketOutlook | MarketDay;
  textbook: TextbookAnswer;
  /** How long one day lasts on screen, so movement keeps pace with playback. */
  tickMs: number;
  selected: AgentRef | null;
  onSelect(agent: AgentRef | null): void;
}

function staircase(heights: ArrayLike<number>, x: (q: number) => number, y: (p: number) => number): string {
  let path = "";
  for (let k = 0; k < heights.length; k++) {
    const level = y(heights[k]).toFixed(1);
    path += k === 0 ? `M${x(0).toFixed(1)},${level}` : `V${level}`;
    path += `H${x(k + 1).toFixed(1)}`;
  }
  return path;
}

export function Diagram({ view, textbook, tickMs, selected, onSelect }: DiagramProps) {
  const [frame, width] = useWidth<HTMLDivElement>(720);
  const [hovered, setHovered] = useState<AgentRef | null>(null);

  const height = Math.round(Math.min(500, Math.max(290, width * 0.6)));
  const margin = { left: 42, right: 10, top: 24, bottom: 42 };
  const plotWidth = Math.max(10, width - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const count = Math.max(view.values.length, view.costs.length);
  const slot = plotWidth / count;
  const radius = Math.max(1.3, Math.min(3.4, slot * 0.4));
  const x = (quantity: number) => margin.left + (quantity / count) * plotWidth;
  const y = (price: number) => margin.top + (1 - price / TOP_PRICE) * plotHeight;
  const baseline = y(0);
  const done = isTraded(view);
  const { price, sellerPrice, wanted, offered, controls } = view;
  const traded = done ? view.traded : 0;

  const paths = useMemo(() => {
    const demand = staircase(view.values, x, y);
    const supply = staircase(view.costs, x, y);
    const oldDemand =
      controls.demandShift === 1 ? null : staircase(Array.from(view.values, (v) => v / controls.demandShift), x, y);
    const oldSupply =
      controls.costShift === 1 ? null : staircase(Array.from(view.costs, (c) => c / controls.costShift), x, y);
    return { demand, supply, oldDemand, oldSupply };
    // x and y depend only on the size and the agent count.
  }, [view.values, view.costs, controls.demandShift, controls.costShift, width, height]);

  const point = (agent: AgentRef) => ({
    cx: x(agent.index + 0.5),
    cy: y(agent.side === "buyer" ? view.values[agent.index] : view.costs[agent.index]),
  });

  const nearest = (event: { clientX: number; clientY: number; currentTarget: SVGRectElement }): AgentRef | null => {
    const box = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    const centre = Math.floor((px - margin.left) / slot);
    let best: AgentRef | null = null;
    let bestDistance = 30;
    for (let index = centre - 4; index <= centre + 4; index++) {
      for (const side of ["buyer", "seller"] as const) {
        const size = side === "buyer" ? view.values.length : view.costs.length;
        if (index < 0 || index >= size) continue;
        const { cx, cy } = point({ side, index });
        const distance = Math.hypot(cx - px, cy - py);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { side, index };
        }
      }
    }
    return best;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = selected ?? { side: "buyer" as const, index: -1 };
    const size = current.side === "buyer" ? view.values.length : view.costs.length;
    if (event.key === "ArrowRight") onSelect({ ...current, index: Math.min(size - 1, current.index + 1) });
    else if (event.key === "ArrowLeft") onSelect({ ...current, index: Math.max(0, current.index - 1) });
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const side = current.side === "buyer" ? "seller" : "buyer";
      const other = side === "buyer" ? view.values.length : view.costs.length;
      onSelect({ side, index: Math.min(other - 1, Math.max(0, current.index)) });
    } else if (event.key === "Escape") onSelect(null);
    else return;
    event.preventDefault();
  };

  const gapFrom = Math.min(wanted, offered);
  const gapTo = Math.max(wanted, offered);
  const gapLabel =
    wanted > offered
      ? `${wanted - offered} ${done ? "go" : "would go"} without`
      : `${offered - wanted} ${done ? "go" : "would go"} unsold`;
  const gapCentre = (x(gapFrom) + x(gapTo)) / 2;
  const priceTag = controls.tax !== 0 ? `buyers pay ${euro(price)}` : `price ${euro(price)}`;
  // The price tag sits at the right-hand end of the line; keep the gap label clear of it.
  const gapCollides = gapCentre + gapLabel.length * 3.4 > x(count) - priceTag.length * 7 - 10;
  const taxTop = y(Math.max(price, sellerPrice));
  const taxHeight = Math.abs(y(sellerPrice) - y(price));

  const pinned = textbook.binding !== "none";
  const textbookMiddle = y(textbook.price);
  const textbookTop = Math.min(textbookMiddle - 8, pinned ? Infinity : y(textbook.priceHigh));
  const textbookBottom = Math.max(textbookMiddle + 8, pinned ? -Infinity : y(textbook.priceLow));

  const focus = hovered ?? selected;
  const focusPoint = focus ? point(focus) : null;
  const move = { transition: `transform ${Math.min(260, Math.round(tickMs * 0.8))}ms linear` };

  const lastSeller = view.costs.length - 1;
  const sellersLabelY = Math.max(margin.top + 12, y(Math.min(view.costs[lastSeller], TOP_PRICE)) - 10);
  const buyersLabelY = Math.max(margin.top + 12, y(Math.min(view.values[0], TOP_PRICE)) - 10);

  return (
    <div
      className="diagram"
      ref={frame}
      tabIndex={0}
      role="group"
      aria-label="Supply and demand diagram. Arrow keys step through buyers and sellers; up and down switch sides."
      onKeyDown={onKeyDown}
    >
      <svg width={width} height={height} role="img" aria-label={
        `Day ${view.day}. Price ${euro(price)}. ${wanted} buyers want a loaf and ${offered} sellers offer one. ` +
        `The textbook answer is ${textbook.quantity} loaves ${textbookPriceText(textbook)}.`
      }>
        <defs>
          <clipPath id="plot-area">
            <rect x={margin.left} y={margin.top - 6} width={plotWidth} height={plotHeight + 6} />
          </clipPath>
        </defs>

        {/* Graph paper: a square for every euro and every ten loaves. */}
        <g className="grid">
          {Array.from({ length: TOP_PRICE + 1 }, (_, euros) => (
            <line key={`h${euros}`} x1={margin.left} x2={x(count)} y1={y(euros)} y2={y(euros)} />
          ))}
          {Array.from({ length: Math.floor(count / 10) + 1 }, (_, tens) => (
            <line key={`v${tens}`} x1={x(tens * 10)} x2={x(tens * 10)} y1={margin.top} y2={baseline} />
          ))}
        </g>
        <g className="axis">
          <line x1={margin.left} x2={x(count)} y1={baseline} y2={baseline} />
          <line x1={margin.left} x2={margin.left} y1={margin.top} y2={baseline} />
          {Array.from({ length: TOP_PRICE / 2 + 1 }, (_, k) => (
            <text key={`p${k}`} x={margin.left - 8} y={y(k * 2) + 4} textAnchor="end">€{k * 2}</text>
          ))}
          {Array.from({ length: Math.floor(count / 20) + 1 }, (_, k) => (
            <text key={`q${k}`} x={x(k * 20)} y={baseline + 17} textAnchor="middle">{k * 20}</text>
          ))}
          <text className="axis-title" x={margin.left - 34} y={margin.top - 10}>price per loaf</text>
          <text className="axis-title" x={x(count)} y={height - 6} textAnchor="end">loaves a day</text>
        </g>

        <g clipPath="url(#plot-area)">
          {/* Where the curves stood before a shift, as a faint trace. */}
          {paths.oldDemand && <path className="curve demand ghost" d={paths.oldDemand} />}
          {paths.oldSupply && <path className="curve supply ghost" d={paths.oldSupply} />}

          {/* Each trader's gain: the bar between what they got and their own limit. */}
          {done && (
            <g className="gains">
              {Array.from(view.buyerStatus, (status, i) =>
                status === TRADED ? (
                  <rect key={`b${i}`} className="demand" x={x(i) + 0.5} width={Math.max(0.5, slot - 1)}
                    y={y(view.values[i])} height={Math.max(0, y(price) - y(view.values[i]))} />
                ) : null,
              )}
              {Array.from(view.sellerStatus, (status, j) =>
                status === TRADED ? (
                  <rect key={`s${j}`} className="supply" x={x(j) + 0.5} width={Math.max(0.5, slot - 1)}
                    y={y(sellerPrice)} height={Math.max(0, y(view.costs[j]) - y(sellerPrice))} />
                ) : null,
              )}
            </g>
          )}
          {controls.tax !== 0 && traded > 0 && (
            <g className="tax-band">
              <rect x={x(0)} width={x(traded) - x(0)} y={taxTop} height={taxHeight} />
              {taxHeight >= 15 && (
                <text x={x(0) + 8} y={taxTop + taxHeight / 2 + 4}>{controls.tax > 0 ? "tax" : "subsidy"}</text>
              )}
            </g>
          )}

          <path className="curve demand" d={paths.demand} />
          <path className="curve supply" d={paths.supply} />

          {/* The gap between willing buyers and willing sellers at today's price. */}
          {gapTo > gapFrom && (
            <line className="gap" x1={x(gapFrom)} x2={x(gapTo)} y1={y(price)} y2={y(price)} />
          )}
          <line className="drop demand" x1={x(wanted)} x2={x(wanted)} y1={y(price)} y2={baseline} />
          <line className="drop supply" x1={x(offered)} x2={x(offered)} y1={y(sellerPrice)} y2={baseline} />

          <g className="price-line" style={{ transform: `translateY(${y(price)}px)`, ...move }}>
            <line x1={margin.left} x2={x(count)} y1={0} y2={0} />
            <text x={x(count) - 6} y={-7} textAnchor="end" className="tag strong">{priceTag}</text>
          </g>
          {controls.tax !== 0 && (
            <g className="price-line keep" style={{ transform: `translateY(${y(sellerPrice)}px)`, ...move }}>
              <line x1={margin.left} x2={x(count)} y1={0} y2={0} />
              <text x={x(count) - 6} y={16} textAnchor="end" className="tag">sellers keep {euro(sellerPrice)}</text>
            </g>
          )}

          {/* What the textbook says: a highlighter stroke over every price that balances this market. */}
          <rect className="textbook" x={x(textbook.quantity) - 6} width={12} rx={6}
            y={textbookTop} height={textbookBottom - textbookTop}>
            <title>{`Textbook answer: ${textbook.quantity} loaves ${textbookPriceText(textbook)}`}</title>
          </rect>

          <g className="agents">
            {Array.from(view.values, (value, i) => {
              const willing = value >= price;
              const state = !willing ? "out" : !done ? "plan" : view.buyerStatus[i] === TRADED ? "traded"
                : view.buyerStatus[i] === MISSED_OUT ? "missed" : "out";
              return <circle key={`b${i}`} className={`agent demand ${state}`} r={radius}
                style={{ transform: `translate(${x(i + 0.5)}px, ${y(value)}px)` }} />;
            })}
            {Array.from(view.costs, (cost, j) => {
              const willing = cost <= sellerPrice;
              const state = !willing ? "out" : !done ? "plan" : view.sellerStatus[j] === TRADED ? "traded"
                : view.sellerStatus[j] === MISSED_OUT ? "missed" : "out";
              return <circle key={`s${j}`} className={`agent supply ${state}`} r={radius}
                style={{ transform: `translate(${x(j + 0.5)}px, ${y(cost)}px)` }} />;
            })}
          </g>
        </g>

        <g className="tags">
          {gapTo > gapFrom && (
            <text x={Math.max(margin.left + 50, gapCentre)} y={gapCollides ? y(price) + 16 : y(price) - 7}
              textAnchor="middle" className="tag strong">{gapLabel}</text>
          )}
          <g className="curve-label">
            <circle className="demand" cx={x(0) + 12} cy={buyersLabelY - 4} r={4} />
            <text x={x(0) + 21} y={buyersLabelY}>buyers</text>
          </g>
          <g className="curve-label">
            <text x={x(count) - 6} y={sellersLabelY} textAnchor="end">sellers</text>
            <circle className="supply" cx={x(count) - 54} cy={sellersLabelY - 4} r={4} />
          </g>
        </g>

        {focusPoint && <circle className="focus-ring" cx={focusPoint.cx} cy={focusPoint.cy} r={radius + 5} />}

        <rect className="hit" x={margin.left} y={margin.top} width={plotWidth} height={plotHeight}
          onPointerMove={(event) => setHovered(nearest(event))}
          onPointerLeave={() => setHovered(null)}
          onClick={(event) => {
            const agent = nearest(event);
            onSelect(agent && selected && agent.side === selected.side && agent.index === selected.index ? null : agent);
          }}
        />
      </svg>

      {hovered && focusPoint && (
        <div className="tooltip" role="presentation" style={{
          left: Math.min(width - 130, Math.max(130, focusPoint.cx)),
          top: focusPoint.cy > 150 ? focusPoint.cy - 14 : focusPoint.cy + 18,
          transform: focusPoint.cy > 150 ? "translate(-50%, -100%)" : "translate(-50%, 0)",
        }}>
          <strong>{agentTitle(hovered)}</strong>
          <span>{describeAgent(hovered, view)}</span>
        </div>
      )}
    </div>
  );
}
