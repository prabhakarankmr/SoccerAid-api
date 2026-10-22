import { ApplyResult, IncomingEvent, Lineup, MatchEngineState } from './types';

/**
 * Pure reducer: (state, lineup, event, now) -> { state, statDeltas, derivedEvents, prompt?, errors? }.
 * Rules for each MatchEventType are ported from the reference app per §6.1 — none implemented yet.
 */
export function apply(
  state: MatchEngineState,
  _lineup: Lineup,
  _event: IncomingEvent,
  _now: Date,
): ApplyResult {
  return { state, statDeltas: [], derivedEvents: [] };
}
