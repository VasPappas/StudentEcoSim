/** Stage 1 on screen: the diagram, the day's numbers, and either a mission or free play beside them. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { defaultMarketControls, type MarketControls } from "../../engine/market";
import { euro, shift } from "../lib/format";
import { DiceIcon, PauseIcon, PlayIcon, RestartIcon, StepIcon } from "../lib/icons";
import { agentTitle, describeAgent, textbookPriceText, type AgentRef } from "./agents";
import { Diagram } from "./Diagram";
import { History } from "./History";
import { Levers } from "./Levers";
import { MissionPanel, type MissionResult, type Phase } from "./MissionPanel";
import { LOW_START_PRICE, missions } from "./missions";
import { Readouts } from "./Readouts";
import { settledPrice, useMarket } from "./useMarket";

const FIRST_TOWN = 2;
const PROGRESS_KEY = "studentecosim.market.progress";
const paces: { label: string; daysPerSecond: number }[] = [
  { label: "Slow", daysPerSecond: 2 },
  { label: "Normal", daysPerSecond: 5 },
  { label: "Fast", daysPerSecond: 15 },
];

function loadProgress(): Record<string, number> {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? "{}");
    if (saved === null || typeof saved !== "object") return {};
    return Object.fromEntries(Object.entries(saved).filter(([, score]) => typeof score === "number"));
  } catch {
    return {};
  }
}

function describeChange(change: Partial<MarketControls>): string {
  if (change.demandShift !== undefined) return `Buyers value bread ${shift(change.demandShift)}.`;
  if (change.costShift !== undefined) return `Sellers' costs ${shift(change.costShift)}.`;
  if (change.priceCap != null) return `No one may charge more than ${euro(change.priceCap)}.`;
  if (change.tax !== undefined) return `A tax of ${euro(change.tax)} on every loaf.`;
  return `Nothing. The price just opens at ${euro(LOW_START_PRICE)}.`;
}

export function MarketStage() {
  const [market, actions] = useMarket(FIRST_TOWN);
  const [mode, setMode] = useState<"missions" | "free">("missions");
  const [missionIndex, setMissionIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("predict");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<MissionResult | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>(loadProgress);
  const [selected, setSelected] = useState<AgentRef | null>(null);
  const board = useRef<HTMLElement | null>(null);

  const restingPrice = useMemo(() => settledPrice(market.seed, defaultMarketControls), [market.seed]);
  const mission = missions[missionIndex];
  const view = market.today ?? market.outlook;

  /** Set the market up for a mission: fresh town, baseline rules, waiting for a prediction. */
  const prepare = useCallback(
    (index: number, seed: number) => {
      const next = missions[index];
      const resting = settledPrice(seed, defaultMarketControls);
      actions.restart({
        seed,
        startPrice: next.start === "low" ? LOW_START_PRICE : resting,
        controls: defaultMarketControls,
      });
      // A settled mission opens on a few quiet days, so there is a "before" to compare with.
      if (next.start === "settled") for (let day = 0; day < 3; day++) actions.step();
      setMissionIndex(index);
      setPhase("predict");
      setAnswers({});
      setResult(null);
      setSelected(null);
    },
    [actions],
  );

  useEffect(() => {
    prepare(0, FIRST_TOWN);
    // Only once, when the stage first opens.
  }, [prepare]);

  const run = () => {
    const change = mission.change(restingPrice);
    const before = market.today;
    const given = answers;
    if (Object.keys(change).length > 0) actions.setControls(change);
    setPhase("running");
    // On a phone the diagram sits above the mission; bring it back into view to watch the run.
    const top = board.current?.getBoundingClientRect().top ?? 0;
    if (top < -40) board.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    actions.play({
      minDays: 3,
      maxDays: 80,
      onStop: (first, last) => {
        const outcome = { before: mission.start === "settled" && before ? before : first, after: last };
        const right = mission.questions.filter(
          (question) => given[question.id] === question.outcome(outcome.before, outcome.after),
        ).length;
        setResult(outcome);
        setPhase("result");
        setProgress((earlier) => {
          const best = Math.max(right, earlier[mission.id] ?? 0);
          const next = { ...earlier, [mission.id]: best };
          try {
            window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
          } catch {
            // Without storage the score still shows for this visit.
          }
          return next;
        });
      },
    });
  };

  const enterFreePlay = () => {
    actions.pause();
    setMode("free");
  };
  const enterMissions = () => {
    setMode("missions");
    prepare(missionIndex, market.seed);
  };
  const newTown = () => {
    const seed = market.seed + 1;
    if (mode === "missions") prepare(missionIndex, seed);
    else actions.restart({ seed });
    setSelected(null);
  };

  const tickMs = market.playing ? 1000 / market.speed : 300;
  const started = market.history.length > 0;

  return (
    <div className="stage">
      <section className="board" aria-label="The market" ref={board}>
        <div className="transport">
          <p className="day">{started ? `Day ${view.day}` : "Before day 1"}</p>
          {mode === "free" && (
            <div className="buttons">
              {market.playing ? (
                <button type="button" className="primary" onClick={actions.pause}><PauseIcon />Pause</button>
              ) : (
                <button type="button" className="primary" onClick={() => actions.play()}><PlayIcon />Play</button>
              )}
              <button type="button" onClick={() => actions.step()} disabled={market.playing}><StepIcon />Next day</button>
              <button type="button" onClick={() => actions.restart()}><RestartIcon />Start over</button>
            </div>
          )}
          <div className="pace segmented" role="radiogroup" aria-label="Playback speed">
            {paces.map(({ label, daysPerSecond }) => (
              <label key={label}>
                <input type="radio" name="pace" checked={market.speed === daysPerSecond}
                  onChange={() => actions.setSpeed(daysPerSecond)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <ul className="key">
          <li><span className="swatch demand" />Buyers, by the most each would pay</li>
          <li><span className="swatch supply" />Sellers, by the least each would take</li>
          <li><span className="swatch textbook" />Textbook answer: {market.textbook.quantity} loaves {textbookPriceText(market.textbook)}</li>
        </ul>

        <Diagram view={view} textbook={market.textbook} tickMs={tickMs} selected={selected} onSelect={setSelected} />

        <div className="agent-card" aria-live="polite">
          {selected ? (
            <p><strong>{agentTitle(selected)}.</strong> {describeAgent(selected, view)}</p>
          ) : (
            <p className="hint">
              Every dot is one person. Filled dots traded, rings missed out, faint dots stayed away. Click one to ask
              what they are doing.
            </p>
          )}
        </div>

      </section>

      <aside className="desk" aria-label={mode === "missions" ? "Missions" : "Free play"}>
        <div className="mode segmented" role="radiogroup" aria-label="Mode">
          <label>
            <input type="radio" name="mode" checked={mode === "missions"} onChange={enterMissions} />
            <span>Missions</span>
          </label>
          <label>
            <input type="radio" name="mode" checked={mode === "free"} onChange={enterFreePlay} />
            <span>Free play</span>
          </label>
        </div>

        {mode === "missions" ? (
          <MissionPanel
            missions={missions}
            index={missionIndex}
            phase={phase}
            answers={answers}
            result={result}
            progress={progress}
            changeNote={describeChange(mission.change(restingPrice))}
            textbook={market.textbook}
            onPick={(index) => prepare(index, market.seed)}
            onAnswer={(questionId, choiceId) => setAnswers((before) => ({ ...before, [questionId]: choiceId }))}
            onRun={run}
            onSkip={actions.finish}
            onRetry={() => prepare(missionIndex, market.seed)}
            onNext={() => (missionIndex + 1 < missions.length ? prepare(missionIndex + 1, market.seed) : enterFreePlay())}
          />
        ) : (
          <div className="free-play">
            <h2>Free play</h2>
            <p className="story">Change anything, at any time, and watch the market respond. Nothing here can break.</p>
            <Levers controls={market.controls} onChange={actions.setControls} />
          </div>
        )}

        <button type="button" className="quiet town" onClick={newTown}>
          <DiceIcon />New town: same rules, different people
        </button>
      </aside>

      <section className="more" aria-label="The numbers">
        <Readouts view={view} textbook={market.textbook} />
        <History days={market.history} />

        {market.problems.length > 0 ? (
          <div className="books bad" role="alert">
            <strong>The books do not balance. Do not rely on these results.</strong>
            <ul>{market.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
          </div>
        ) : (
          <p className="books">Checked every day: each loaf bought was sold, and each euro paid was received.</p>
        )}

        <details className="rules">
          <summary>How this market works</summary>
          <ul>
            <li>There are 100 buyers and 100 sellers. Each buyer wants one loaf a day; each seller can make one.</li>
            <li>Every buyer has a private limit, the most they would pay. Every seller has one too, the least they would take.</li>
            <li>Everyone sees one going price. Whoever is happy with it turns up to trade.</li>
            <li>If one side outnumbers the other, lots are drawn for who gets to trade.</li>
            <li>
              Overnight the price moves towards the crowded side, further the more lopsided the day was. Each time it
              overshoots, it moves half as boldly.
            </li>
            <li>
              The textbook answer is worked out separately from the same list of limits, so the two can be compared.
              With only 100 people a side, a small range of prices balances the market; the smooth curves in a
              textbook shrink that range to a single point.
            </li>
          </ul>
        </details>
      </section>
    </div>
  );
}
