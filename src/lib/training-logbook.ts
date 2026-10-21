import { todayInBrasilia } from "./tz";

export const LOGBOOK_CONFLICT = "student_id,exercise,week_number,set_index";

export function currentTrainingWeek(startDate: string, today = todayInBrasilia()): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return 0;
  return Math.floor((now - start) / 604800000) + 1;
}

// Any week of the plan is editable; currentTrainingWeek only picks the default week.
export function canEditTrainingWeek(week: number, totalWeeks: number) {
  return week >= 1 && week <= totalWeeks;
}

export function prescribedSetCount(sets: string): number {
  const count = parseInt(sets, 10);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

export type WeekLogRow = {
  id: string; exercise: string; load: string; reps: string; entry_date: string;
  week_number: number | null; set_index: number | null; block_label?: string | null;
};

export function sameWeekEntries(rows: WeekLogRow[], week: number) {
  return rows.filter((row) => row.week_number === week && row.set_index !== null)
    .sort((a, b) => (a.set_index ?? 0) - (b.set_index ?? 0));
}

export function weeklyLogPayload(studentId: string, entry: {
  exercise: string; load: string; reps: string; week_number: number; set_index: number;
  block_label?: string | null; entry_date: string; order_index: number;
}) {
  // Deliberately excludes id: no historical row can be re-keyed into another week.
  return { student_id: studentId, ...entry };
}