/** Free play: the five things a student can change, each in the units they would say out loud. */
import { type MarketControls } from "../../engine/market";
import { euro, shift } from "../lib/format";

interface LeversProps {
  controls: MarketControls;
  onChange(change: Partial<MarketControls>): void;
}

const speeds: { label: string; value: number }[] = [
  { label: "Slow", value: 0.15 },
  { label: "Steady", value: 0.35 },
  { label: "Jumpy", value: 0.9 },
];

export function Levers({ controls, onChange }: LeversProps) {
  const rule = controls.priceCap !== null ? "cap" : controls.priceFloor !== null ? "floor" : "none";
  const level = controls.priceCap ?? controls.priceFloor ?? 3;
  const setRule = (kind: string, amount: number) =>
    onChange({ priceCap: kind === "cap" ? amount : null, priceFloor: kind === "floor" ? amount : null });

  return (
    <div className="levers">
      <label className="lever">
        <span>What bread is worth to buyers</span>
        <output>{shift(controls.demandShift)}</output>
        <input type="range" min={0.6} max={1.4} step={0.05} value={controls.demandShift}
          onChange={(event) => onChange({ demandShift: Number(event.target.value) })} />
      </label>
      <label className="lever">
        <span>What a loaf costs to make</span>
        <output>{shift(controls.costShift)}</output>
        <input type="range" min={0.6} max={1.4} step={0.05} value={controls.costShift}
          onChange={(event) => onChange({ costShift: Number(event.target.value) })} />
      </label>
      <label className="lever">
        <span>{controls.tax < 0 ? "Subsidy per loaf" : "Tax per loaf"}</span>
        <output>{euro(Math.abs(controls.tax))}</output>
        <input type="range" min={-1} max={3} step={0.1} value={controls.tax}
          onChange={(event) => onChange({ tax: Math.round(Number(event.target.value) * 10) / 10 })} />
      </label>

      <fieldset className="lever">
        <legend>Legal price limit</legend>
        <div className="segmented" role="radiogroup" aria-label="Legal price limit">
          {[["none", "None"], ["cap", "Maximum"], ["floor", "Minimum"]].map(([kind, label]) => (
            <label key={kind}>
              <input type="radio" name="price-rule" checked={rule === kind} onChange={() => setRule(kind, level)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {rule !== "none" && (
          <label className="lever nested">
            <span>{rule === "cap" ? "No one may charge more than" : "No one may charge less than"}</span>
            <output>{euro(level)}</output>
            <input type="range" min={1} max={8} step={0.1} value={level}
              onChange={(event) => setRule(rule, Math.round(Number(event.target.value) * 10) / 10)} />
          </label>
        )}
      </fieldset>

      <fieldset className="lever">
        <legend>How fast the price reacts</legend>
        <div className="segmented" role="radiogroup" aria-label="How fast the price reacts">
          {speeds.map(({ label, value }) => (
            <label key={label}>
              <input type="radio" name="price-speed" checked={controls.priceSpeed === value}
                onChange={() => onChange({ priceSpeed: value })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
