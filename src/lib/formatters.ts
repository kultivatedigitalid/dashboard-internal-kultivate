const jakartaDate = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const jakartaDateTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value: string | Date): string {
  return jakartaDate.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return jakartaDateTime.format(new Date(value));
}

export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function minutesToHours(minutes: number): number {
  return Math.max(0, Math.round((minutes / 60) * 10) / 10);
}

export function calculateWorkedMinutes(
  checkIn: Date,
  checkOut: Date,
  breakMinutes = 0,
): number {
  const elapsed = Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000);
  return Math.max(0, elapsed - Math.max(0, breakMinutes));
}

export function calculateProgress(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((actual / target) * 100)));
}

export function getMonday(value = new Date()): Date {
  const date = new Date(value);
  const day = date.getDay();
  const distance = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + distance);
  date.setHours(0, 0, 0, 0);
  return date;
}
