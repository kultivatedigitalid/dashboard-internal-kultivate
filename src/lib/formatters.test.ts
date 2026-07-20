import { describe, expect, it } from 'vitest';
import {
  calculateProgress,
  calculateWorkedMinutes,
  formatIDR,
  getMonday,
  minutesToHours,
} from './formatters';

describe('dashboard formatters', () => {
  it('subtracts break minutes from a work session', () => {
    const start = new Date('2026-07-20T01:00:00.000Z');
    const end = new Date('2026-07-20T10:00:00.000Z');
    expect(calculateWorkedMinutes(start, end, 60)).toBe(480);
  });

  it('never returns negative worked minutes', () => {
    const start = new Date('2026-07-20T10:00:00.000Z');
    const end = new Date('2026-07-20T09:00:00.000Z');
    expect(calculateWorkedMinutes(start, end, 0)).toBe(0);
  });

  it('caps visual progress at one hundred percent', () => {
    expect(calculateProgress(720, 600)).toBe(100);
    expect(calculateProgress(300, 600)).toBe(50);
  });

  it('formats duration and Indonesian currency', () => {
    expect(minutesToHours(495)).toBe(8.3);
    expect(formatIDR(125000)).toContain('125.000');
  });

  it('returns Monday for the selected week', () => {
    expect(getMonday(new Date('2026-07-23T12:00:00+07:00')).getDay()).toBe(1);
  });
});
