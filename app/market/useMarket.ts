import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  checkDay,
  createMarket,
  defaultMarketControls,
  defaultMarketSettings,
  summarise,
  textbookAnswer,
  type DaySummary,
  type Market,
  type MarketControls,
  type MarketDay,
  type MarketOutlook,
  type TextbookAnswer,
} from "../../engine/market";

/** One day in the history strip: what happened, next to what the textbook expected. */
export interface HistoryDay extends DaySummary {
  /** The lowest and highest price the textbook accepts that day (equal when a legal limit pins it). */
  textbookLow: number;
  textbookHigh: number;
  textbookQuantity: number;
}

export interface AutoStop {
  /** Run at least this many days before stopping. */
  minDays: number;
  /** Give up waiting for the price to settle after this many days. */
  maxDays: number;
  /** Called once, with the first and last day of the run. */
  onStop: (first: MarketDay, last: MarketDay) => void;
}

export interface MarketState {
  seed: number;
  controls: MarketControls;
  /** The coming day under the current controls. */
  outlook: MarketOutlook;
  /** The latest traded day, or null when nothing has traded since the controls last changed. */
  today: MarketDay | null;
  /** The textbook answer for the current buyers, sellers and rules. */
  textbook: TextbookAnswer;
  history: HistoryDay[];
  playing: boolean;
  /** Days per second while playing. */
  speed: number;
  /** Anything the daily bookkeeping check found wrong. Empty when all is well. */
  problems: string[];
}

export interface MarketActions {
  play(autoStop?: AutoStop): void;
  /** Run straight through to the end of an automatic run instead of watching it. */
  finish(): void;
  pause(): void;
  step(): MarketDay;
  setSpeed(speed: number): void;
  setControls(change: Partial<MarketControls>): void;
  restart(options?: { seed?: number; startPrice?: number; controls?: MarketControls }): void;
}

const HISTORY_LIMIT = 400;

export function answerFor(view: MarketOutlook, controls: MarketControls): TextbookAnswer {
  return textbookAnswer(view.values, view.costs, controls);
}

/** The textbook price for a fresh market with this seed: a calm place to start a mission. */
export function settledPrice(seed: number, controls: MarketControls): number {
  const market = createMarket(defaultMarketSettings, seed);
  return answerFor(market.outlook(controls), controls).price;
}

export function useMarket(initialSeed: number): [MarketState, MarketActions] {
  const market = useRef<Market | null>(null);
  const autoStop = useRef<(AutoStop & { first: MarketDay | null; days: number }) | null>(null);

  const [seed, setSeed] = useState(initialSeed);
  const seedRef = useRef(initialSeed);
  const [controls, setControlsState] = useState<MarketControls>(defaultMarketControls);
  const controlsRef = useRef(controls);
  const [outlook, setOutlook] = useState<MarketOutlook>(() => {
    market.current = createMarket(defaultMarketSettings, initialSeed);
    return market.current.outlook(defaultMarketControls);
  });
  const [today, setToday] = useState<MarketDay | null>(null);
  const [history, setHistory] = useState<HistoryDay[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [problems, setProblems] = useState<string[]>([]);

  const textbook = useMemo(() => answerFor(outlook, controls), [outlook, controls]);

  const pause = useCallback(() => {
    setPlaying(false);
    autoStop.current = null;
  }, []);

  const step = useCallback((): MarketDay => {
    const sim = market.current!;
    const rules = controlsRef.current;
    const day = sim.advance(rules);
    const answer = textbookAnswer(day.values, day.costs, rules);
    const found = checkDay(day);
    if (found.length > 0) setProblems((before) => (before.length > 0 ? before : found));
    setToday(day);
    setOutlook(sim.outlook(rules));
    setHistory((before) => {
      const pinned = answer.binding !== "none";
      const next = [...before, {
        ...summarise(day),
        textbookLow: pinned ? answer.price : answer.priceLow,
        textbookHigh: pinned ? answer.price : answer.priceHigh,
        textbookQuantity: answer.quantity,
      }];
      return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
    });

    const stop = autoStop.current;
    if (stop) {
      stop.first ??= day;
      stop.days += 1;
      const settled = day.nextPrice === day.price;
      if ((settled && stop.days >= stop.minDays) || stop.days >= stop.maxDays) {
        autoStop.current = null;
        setPlaying(false);
        stop.onStop(stop.first, day);
      }
    }
    return day;
  }, []);

  const play = useCallback((stop?: AutoStop) => {
    autoStop.current = stop ? { ...stop, first: null, days: 0 } : null;
    setPlaying(true);
  }, []);

  const finish = useCallback(() => {
    for (let guard = 0; autoStop.current && guard < 500; guard++) step();
  }, [step]);

  const setControls = useCallback((change: Partial<MarketControls>) => {
    const next = { ...controlsRef.current, ...change };
    controlsRef.current = next;
    setControlsState(next);
    setOutlook(market.current!.outlook(next));
    // Yesterday's trades were made under the old rules; show the plan for the coming day instead.
    setToday(null);
  }, []);

  const restart = useCallback((options?: { seed?: number; startPrice?: number; controls?: MarketControls }) => {
    const nextSeed = options?.seed ?? seedRef.current;
    seedRef.current = nextSeed;
    const nextControls = options?.controls ?? controlsRef.current;
    const settings = { ...defaultMarketSettings, startPrice: options?.startPrice ?? defaultMarketSettings.startPrice };
    market.current = createMarket(settings, nextSeed);
    controlsRef.current = nextControls;
    autoStop.current = null;
    setSeed(nextSeed);
    setControlsState(nextControls);
    setOutlook(market.current.outlook(nextControls));
    setToday(null);
    setHistory([]);
    setPlaying(false);
    setProblems([]);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(step, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, step]);

  const state: MarketState = { seed, controls, outlook, today, textbook, history, playing, speed, problems };
  const actions: MarketActions = useMemo(
    () => ({ play, finish, pause, step, setSpeed, setControls, restart }),
    [play, finish, pause, step, setControls, restart],
  );
  return [state, actions];
}
