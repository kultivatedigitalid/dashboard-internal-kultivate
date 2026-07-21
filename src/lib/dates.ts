const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function jakartaDate(date = new Date()): string {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

export function currentWeekStart(date = new Date()): string {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  const day = shifted.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  shifted.setUTCDate(shifted.getUTCDate() + delta);
  return shifted.toISOString().slice(0, 10);
}

export function netHours(checkIn: string, checkOut: string | null, breakMinutes = 0): number {
  if (!checkOut) return 0;
  return Math.max(0, (Date.parse(checkOut) - Date.parse(checkIn)) / 3_600_000 - breakMinutes / 60);
}
