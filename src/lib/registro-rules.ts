export const STREAK_THRESHOLD = 80;
export const RETROACTIVE_DAYS = 7;

export function addRegistroDays(iso: string, delta: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function validRegistroDate(iso: string): boolean {
  const date = new Date(`${iso}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso;
}

export function canEditRegistroDate(date: string, today: string): boolean {
  return validRegistroDate(date) && date <= today && date >= addRegistroDays(today, -RETROACTIVE_DAYS);
}

export function prescribedMealNames(diet: unknown): string[] {
  const meals = (diet as { refeicoes?: { nome?: string }[] } | null)?.refeicoes;
  if (!Array.isArray(meals)) return [];
  return [...new Set(meals.map(m => String(m?.nome ?? '').trim()).filter(Boolean))];
}

export function mealPercentage(ratings: number[], totalMeals: number): number {
  return totalMeals > 0 ? Math.min(1, ratings.reduce((a, b) => a + Math.max(0, Math.min(5, b)), 0) / (totalMeals * 5)) : 0;
}

export function calcScore(input: {
  waterMl: number; waterGoalMl: number; trained: boolean;
  mealRatings: number[]; totalMeals: number; restDay?: boolean;
}): number {
  const water = input.waterGoalMl > 0 ? Math.min(input.waterMl / input.waterGoalMl, 1) : 0;
  const wWater = input.waterGoalMl > 0 ? (input.restDay ? 40 : 30) : 0;
  const wTraining = input.restDay ? 0 : 25;
  const wMeals = input.restDay ? 60 : 45;
  const raw = water * wWater + Number(input.trained) * wTraining + mealPercentage(input.mealRatings, input.totalMeals) * wMeals;
  return Math.round(Math.max(0, Math.min(100, raw / (wWater + wTraining + wMeals) * 100)) * 10) / 10;
}

export function calculateStreak(logs: { log_date: string; daily_score: number; rest_day?: boolean }[], neutralDates: string[], today: string) {
  const byDate = new Map(logs.map(l => [l.log_date, l]));
  const neutral = new Set(neutralDates);
  const first = [...byDate.keys()].filter(d => d <= today).sort()[0] ?? today;
  let current = 0, longest = 0, shields = 0, progress = 0, total = 0;
  let last: string | null = null;
  let consumedToday = false;
  for (let date = first; date <= today; date = addRegistroDays(date, 1)) {
    const log = byDate.get(date);
    // Travel is always neutral, even if the student also entered a high score.
    if (neutral.has(date)) continue;
    const score = Number(log?.daily_score) || 0;
    if (score >= STREAK_THRESHOLD) {
      current++; total++; last = date;
      if (score >= 100) {
        progress++;
        if (progress >= 7) { shields = Math.min(2, shields + 1); progress = 0; }
      } else progress = 0;
    } else if (log?.rest_day || date === today) {
      // Today is not a failed day before it has ended.
      continue;
    } else if (current > 0 && shields > 0) {
      shields--; progress = 0; consumedToday = date === today;
    } else { current = 0; progress = 0; }
    longest = Math.max(longest, current);
  }
  return { current_streak: current, longest_streak: longest, shields, shield_progress: progress,
    total_completed_days: total, last_completed_date: last, shield_consumed_today: consumedToday };
}