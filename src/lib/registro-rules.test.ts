import { describe, expect, it } from 'vitest';
import { addRegistroDays, calcScore, calculateStreak, canEditRegistroDate, mealPercentage, validRegistroDate } from './registro-rules';
import { OptimisticDayQueue } from './registro-optimistic';

describe('daily registration rules', () => {
  it('counts one five-star meal out of five as 20% of the diet', () => {
    expect(mealPercentage([5], 5)).toBe(0.2);
    expect(calcScore({ waterMl: 0, waterGoalMl: 3000, trained: false, mealRatings: [5], totalMeals: 5 })).toBe(9);
  });
  it('counts unchecked meals as zero even when old ratings remain', () => {
    expect(mealPercentage([], 5)).toBe(0);
    expect(mealPercentage([5, 5, 5, 5, 5], 5)).toBe(1);
  });
  it('preserves the no-water-goal scoring rule', () => {
    expect(calcScore({ waterMl: 0, waterGoalMl: 0, trained: true, mealRatings: [5, 5, 5, 5, 5], totalMeals: 5 })).toBe(100);
  });
  it('allows today and all seven previous days but not older or future dates', () => {
    expect(canEditRegistroDate('2026-10-22', '2026-10-22')).toBe(true);
    expect(canEditRegistroDate('2026-10-15', '2026-10-22')).toBe(true);
    expect(canEditRegistroDate('2026-10-14', '2026-10-22')).toBe(false);
    expect(canEditRegistroDate('2026-10-23', '2026-10-22')).toBe(false);
  });
  it('rejects nonexistent calendar dates', () => {
    expect(validRegistroDate('2026-02-30')).toBe(false);
    expect(validRegistroDate('2026-02-28')).toBe(true);
  });
  const completed = Array.from({ length: 43 }, (_, i) => ({ log_date: addRegistroDays('2026-08-01', i), daily_score: 80 }));
  it('preserves 43 days through two neutral travel days and future planned days', () => {
    const travel = ['2026-09-13', '2026-09-14', '2026-09-16'];
    expect(calculateStreak(completed, travel, '2026-09-14').current_streak).toBe(43);
    expect(calculateStreak([...completed, { log_date: '2026-09-15', daily_score: 80 }], travel, '2026-09-15').current_streak).toBe(44);
  });
  it('does not inflate streak on a neutral day even with 100 points', () => {
    expect(calculateStreak([...completed, { log_date: '2026-09-13', daily_score: 100 }], ['2026-09-13'], '2026-09-13').current_streak).toBe(43);
  });
  it('does not reset streak before today has ended', () => {
    expect(calculateStreak(completed, [], '2026-09-13').current_streak).toBe(43);
    expect(calculateStreak(completed, [], '2026-09-14').current_streak).toBe(0);
  });
  it('retains the two-shield maximum', () => {
    const logs = Array.from({ length: 21 }, (_, i) => ({ log_date: addRegistroDays('2026-08-01', i), daily_score: 100 }));
    expect(calculateStreak(logs, [], '2026-08-21').shields).toBe(2);
  });
});

describe('pending registration cache', () => {
  it('keeps later optimistic actions above the first server response', () => {
    const queue = new OptimisticDayQueue({ water: 0, trained: false, meals: false });
    queue.add(1, d => { d.water += 250; });
    queue.add(2, d => { d.trained = true; });
    queue.add(3, d => { d.meals = true; });
    expect(queue.settle(1, { water: 250, trained: false, meals: false })).toEqual({ water: 250, trained: true, meals: true });
    expect(queue.settle(2, { water: 250, trained: true, meals: false }).meals).toBe(true);
    expect(queue.settle(3, { water: 250, trained: true, meals: true })).toEqual({ water: 250, trained: true, meals: true });
    expect(queue.pending).toBe(0);
  });
  it('rolls back only a failed action, preserving other clicks', () => {
    const queue = new OptimisticDayQueue({ water: 0, trained: false });
    queue.add(1, d => { d.water += 250; });
    queue.add(2, d => { d.trained = true; });
    expect(queue.settle(1)).toEqual({ water: 0, trained: true });
  });
});