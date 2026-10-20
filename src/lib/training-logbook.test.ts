import { describe, expect, it } from "vitest";
import { canEditTrainingWeek, currentTrainingWeek, LOGBOOK_CONFLICT, prescribedSetCount, sameWeekEntries, weeklyLogPayload, type WeekLogRow } from "./training-logbook";
import { describeCell } from "./training-xlsx-parser";

describe("periodization logbook", () => {
  const rows: WeekLogRow[] = [
    { id: "old", exercise: "Supino", load: "10/12", reps: "10/8", entry_date: "2026-10-01", week_number: null, set_index: null },
    { id: "a", exercise: "Supino", load: "20", reps: "10", entry_date: "2026-10-06", week_number: 1, set_index: 1 },
    { id: "b", exercise: "Supino", load: "22", reps: "8", entry_date: "2026-10-13", week_number: 2, set_index: 1 },
    { id: "c", exercise: "Supino", load: "25", reps: "6", entry_date: "2026-10-13", week_number: 2, set_index: 2 },
  ];
  it("keeps different weeks and sets isolated", () => {
    expect(sameWeekEntries(rows, 1).map(r => r.load)).toEqual(["20"]);
    expect(sameWeekEntries(rows, 2).map(r => r.load)).toEqual(["22", "25"]);
    expect(LOGBOOK_CONFLICT).toBe("student_id,exercise,week_number,set_index");
  });
  it("starts week two after seven calendar days, independent of UTC hour", () => {
    expect(currentTrainingWeek("2026-10-13", "2026-10-19")).toBe(1);
    expect(currentTrainingWeek("2026-10-13", "2026-10-20")).toBe(2);
  });
  it("locks past and future weeks", () => {
    expect(canEditTrainingWeek(1, "2026-10-13", 8, "2026-10-20")).toBe(false);
    expect(canEditTrainingWeek(2, "2026-10-13", 8, "2026-10-20")).toBe(true);
    expect(canEditTrainingWeek(3, "2026-10-13", 8, "2026-10-20")).toBe(false);
  });
  it("does not keep the last week editable once the cycle has ended", () => {
    expect(canEditTrainingWeek(2, "2026-10-01", 2, "2026-10-20")).toBe(false);
  });
  it("uses the selected week's prescribed set count", () => {
    expect(prescribedSetCount("3")).toBe(3);
    expect(prescribedSetCount("4")).toBe(4);
    expect(prescribedSetCount(describeCell("2x(4x4)").sets ?? "")).toBe(2);
  });
  it("never carries an old row id into an upsert for a different week", () => {
    const payload = weeklyLogPayload("student", { exercise: "Supino", load: "22", reps: "8", week_number: 2, set_index: 1, entry_date: "2026-10-20", order_index: 0 });
    expect(payload).not.toHaveProperty("id");
    expect(payload.week_number).toBe(2);
    expect(payload.set_index).toBe(1);
  });
  it("preserves history even when the replacement plan has different exercises", () => {
    const before = JSON.stringify(rows);
    expect(sameWeekEntries(rows, 1)[0]?.exercise).toBe("Supino");
    expect(sameWeekEntries(rows, 2)).toHaveLength(2);
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows.find(r => r.id === "old")?.load).toBe("10/12");
  });
});