// Timezone helpers pinned to Brasília (America/Sao_Paulo, UTC-3, no DST).
// Use these everywhere the app needs "today"/"yesterday" as a YYYY-MM-DD date.

export function todayInBrasilia(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA => YYYY-MM-DD
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function yesterdayInBrasilia(): string {
  return addDaysIso(todayInBrasilia(), -1);
}
