export const REST_TIMER_KEY = 'treino:restState';
export type RestTimerState = { endAt: number | null; remaining: number };
export function remainingRestSeconds(endAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((endAt - now) / 1000));
}
export function startRestTimer(seconds: number, now = Date.now()): RestTimerState {
  return { endAt: now + seconds * 1000, remaining: seconds };
}
export function pauseRestTimer(state: RestTimerState, now = Date.now()): RestTimerState {
  return { endAt: null, remaining: state.endAt === null ? state.remaining : remainingRestSeconds(state.endAt, now) };
}