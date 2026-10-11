/** A mission: read the story, commit to a prediction, then watch the market answer. */
import type { MarketDay, TextbookAnswer } from "../../engine/market";
import { CheckIcon, CrossIcon } from "../lib/icons";
import { euro } from "../lib/format";
import { textbookPriceText } from "./agents";
import type { Mission } from "./missions";

export type Phase = "predict" | "running" | "result";

export interface MissionResult {
  before: MarketDay;
  after: MarketDay;
}

interface MissionPanelProps {
  missions: Mission[];
  index: number;
  phase: Phase;
  answers: Record<string, string>;
  result: MissionResult | null;
  /** Best number of right answers so far, by mission id. */
  progress: Record<string, number>;
  /** The change this mission makes, in concrete terms. */
  changeNote: string;
  textbook: TextbookAnswer;
  onPick(index: number): void;
  onAnswer(questionId: string, choiceId: string): void;
  onRun(): void;
  onSkip(): void;
  onRetry(): void;
  onNext(): void;
}

export function MissionPanel(props: MissionPanelProps) {
  const { missions, index, phase, answers, result, progress, changeNote, textbook } = props;
  const mission = missions[index];
  const ready = mission.questions.every((question) => answers[question.id] !== undefined);
  const isLast = index === missions.length - 1;

  return (
    <div className="mission">
      <ol className="mission-list">
        {missions.map((item, k) => {
          const best = progress[item.id];
          return (
            <li key={item.id}>
              <button type="button" title={item.title} aria-current={k === index ? "step" : undefined}
                onClick={() => props.onPick(k)}>
                <span className="number">{k + 1}</span>
                <span className="name">{item.title}</span>
                {best !== undefined && (
                  <span className="best" title="Best score so far">
                    {best}/{item.questions.length}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <article className="mission-card" aria-live="polite">
        <h2>{mission.title}</h2>
        <p className="story">{mission.story}</p>
        <p className="change"><span>What changes</span>{changeNote}</p>

        {phase !== "result" && (
          <form onSubmit={(event) => { event.preventDefault(); if (ready && phase === "predict") props.onRun(); }}>
            {mission.questions.map((question) => (
              <fieldset key={question.id} disabled={phase !== "predict"}>
                <legend>{question.prompt}</legend>
                <div className="choices">
                  {question.choices.map((choice) => (
                    <label key={choice.id}>
                      <input type="radio" name={`${mission.id}-${question.id}`}
                        checked={answers[question.id] === choice.id}
                        onChange={() => props.onAnswer(question.id, choice.id)} />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            {phase === "predict" ? (
              <>
                <button type="submit" className="primary" disabled={!ready}>Run the market</button>
                {!ready && <p className="hint">Commit to a prediction first. Being wrong is how this works.</p>}
              </>
            ) : (
              <div className="running">
                <p>The market is working it out, one day at a time.</p>
                <button type="button" className="quiet" onClick={props.onSkip}>Skip to the result</button>
              </div>
            )}
          </form>
        )}

        {phase === "result" && result && (
          <div className="result">
            <ul className="verdicts">
              {mission.questions.map((question) => {
                const outcome = question.outcome(result.before, result.after);
                const right = answers[question.id] === outcome;
                const said = question.choices.find((choice) => choice.id === answers[question.id])?.label ?? "No answer";
                return (
                  <li key={question.id} className={right ? "right" : "wrong"}>
                    <span className="mark">{right ? <CheckIcon /> : <CrossIcon />}</span>
                    <div>
                      <strong>{right ? "You called it." : "Not this time."}</strong>
                      <p className="said">You said: {said.toLowerCase()}.</p>
                      <p>{question.report(result.before, result.after)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="lesson">{mission.lesson(result.before, result.after)}</p>
            <p className="check">
              <span className="swatch textbook" />
              Textbook answer: {textbook.quantity} loaves {textbookPriceText(textbook)}. Your market: {result.after.traded}{" "}
              loaves at {euro(result.after.price)}.
            </p>
            <div className="actions">
              <button type="button" className="primary" onClick={props.onNext}>
                {isLast ? "Go to free play" : "Next mission"}
              </button>
              <button type="button" className="quiet" onClick={props.onRetry}>Try it again</button>
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
