/**
 * The whole surface the interface is allowed to use, for every stage.
 *
 * A stage offers one "create" function (set up) that returns a Simulation.
 * The interface then only ever asks three things of it. Keeping this narrow
 * is what lets the engine behind it be replaced later without touching the
 * interface.
 */
export interface Simulation<Controls, Period, Outlook> {
  /** How many periods have been run so far. */
  readonly period: number;
  /** What the coming period looks like under these controls. Changes nothing. */
  outlook(controls: Controls): Outlook;
  /** Run one period under these controls and report what happened. */
  advance(controls: Controls): Period;
}
