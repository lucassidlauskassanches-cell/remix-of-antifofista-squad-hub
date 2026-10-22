import { describe, expect, it } from 'vitest';
import { pauseRestTimer, remainingRestSeconds, startRestTimer } from './rest-timer';

describe('rest deadline', () => {
  it('starts a 90 second rest anchored to an absolute deadline', () => {
    expect(startRestTimer(90, 1000)).toEqual({ endAt: 91000, remaining: 90 });
  });
  it('restores accurate time after backgrounding and reload', () => {
    const saved = JSON.parse(JSON.stringify(startRestTimer(90, 1000)));
    expect(remainingRestSeconds(saved.endAt, 11000)).toBe(80);
    expect(remainingRestSeconds(saved.endAt, 90001)).toBe(1);
    expect(remainingRestSeconds(saved.endAt, 100000)).toBe(0);
  });
  it('pauses with the deadline-derived remaining time', () => {
    expect(pauseRestTimer(startRestTimer(90, 1000), 16000)).toEqual({ endAt: null, remaining: 75 });
  });
});