import { describe, expect, it } from 'vitest';

import {
  addDaysISO,
  durationLabel,
  formatDateTimeInZone,
  formatISODateLabel,
  formatTimeInZone,
  formatWallClock,
  minutesInZone,
  wallClockToMinutes,
  weekdayFromISODate,
  weekdayName,
  zonedToday,
  zonedWallClockToInstant,
} from './format';

/**
 * The store-zone helpers, pinned against the failure they exist to prevent: an
 * appointment rendered on the viewer's clock instead of the shop's.
 *
 * Every case below deliberately uses a zone the test runner is not in, and
 * asserts on the shop's reading. A helper that quietly fell back to the local
 * zone would still look plausible on a developer's machine in Asia/Kolkata and
 * would send a customer in London to the wrong hour.
 */
describe('store-timezone formatting', () => {
  const KOLKATA = 'Asia/Kolkata'; // UTC+5:30, no daylight saving
  const NEW_YORK = 'America/New_York'; // UTC-4/-5, daylight saving

  it('renders one instant as two different clock faces', () => {
    // 09:00 UTC is 14:30 in Kolkata and 05:00 in New York (EDT). The instant is
    // the same; what a customer must read is not.
    const instant = '2026-08-21T09:00:00Z';
    expect(formatTimeInZone(instant, KOLKATA)).toBe('2:30 PM');
    expect(formatTimeInZone(instant, NEW_YORK)).toBe('5:00 AM');
  });

  it('rolls the date over in the shop zone, not in UTC', () => {
    // 20:00 UTC is already the 22nd in Kolkata. A UI reading this in UTC would
    // show a customer the wrong day for their own appointment.
    const lateEvening = '2026-08-21T20:00:00Z';
    expect(formatDateTimeInZone(lateEvening, KOLKATA)).toContain('22');
    expect(formatDateTimeInZone(lateEvening, 'UTC')).toContain('21');
  });

  it('reports minutes since midnight on the shop clock', () => {
    // The number a day view positions blocks with.
    expect(minutesInZone('2026-08-21T04:00:00Z', KOLKATA)).toBe(9 * 60 + 30);
    expect(minutesInZone('2026-08-21T04:00:00Z', 'UTC')).toBe(4 * 60);
  });

  it('converts a shop wall clock back into the instant the server wants', () => {
    // Midnight in Kolkata is 18:30 UTC the day before — the conversion the
    // console needs to ask for "everything on the 21st" without dropping the
    // first and last appointments of the day.
    expect(zonedWallClockToInstant('2026-08-21', 0, KOLKATA)).toBe('2026-08-20T18:30:00.000Z');
    expect(zonedWallClockToInstant('2026-08-21', 0, 'UTC')).toBe('2026-08-21T00:00:00.000Z');
  });

  it('survives a daylight-saving change when converting a wall clock', () => {
    // 8 March 2026 is a spring-forward day in New York: midnight is still EST
    // (UTC-5), while midnight the next day is EDT (UTC-4). A fixed offset would
    // be an hour out on one of them.
    expect(zonedWallClockToInstant('2026-03-08', 0, NEW_YORK)).toBe('2026-03-08T05:00:00.000Z');
    expect(zonedWallClockToInstant('2026-03-09', 0, NEW_YORK)).toBe('2026-03-09T04:00:00.000Z');
  });

  it('answers "today" on the shop calendar', () => {
    // Can only be asserted structurally, but the two readings must be one of the
    // same day or a legitimate neighbour — never a parse failure.
    const here = zonedToday(KOLKATA);
    expect(here).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(zonedToday('Pacific/Kiritimati')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does calendar arithmetic without drifting across a DST boundary', () => {
    expect(addDaysISO('2026-08-21', 1)).toBe('2026-08-22');
    expect(addDaysISO('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
    // Leap day, and a spring-forward day that a local-time implementation would
    // land on twice.
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2026-03-07', 1)).toBe('2026-03-08');
  });

  it('speaks ISO weekdays, where Monday is 1 and Sunday is 7', () => {
    // JavaScript's getDay() would call the Sunday 0 and shift a whole week of
    // opening hours by one day.
    expect(weekdayFromISODate('2026-08-17')).toBe(1); // Monday
    expect(weekdayFromISODate('2026-08-23')).toBe(7); // Sunday
    expect(weekdayName(1)).toBe('Monday');
    expect(weekdayName(7, true)).toBe('Sun');
  });

  it('formats a bare wall clock without inventing a date or a zone', () => {
    // Opening hours and availability labels arrive as "HH:mm" with no day
    // attached — parsing them as dates would attach both.
    expect(formatWallClock('09:30')).toBe('9:30 AM');
    expect(formatWallClock('12:00')).toBe('12:00 PM');
    expect(formatWallClock('00:15')).toBe('12:15 AM');
    expect(formatWallClock('20:00')).toBe('8:00 PM');
    expect(formatWallClock(null)).toBe('—');
    expect(wallClockToMinutes('09:30')).toBe(570);
  });

  it('labels a plain calendar date without shifting it', () => {
    // Rendered through UTC on purpose: a YYYY-MM-DD is a date, not a moment, and
    // reading it in a negative-offset zone would show the day before.
    expect(formatISODateLabel('2026-08-21')).toContain('21');
    expect(formatISODateLabel('2026-01-01')).toContain('1');
  });

  it('describes how long an appointment takes', () => {
    expect(durationLabel(45)).toBe('45 min');
    expect(durationLabel(60)).toBe('1 hr');
    expect(durationLabel(75)).toBe('1 hr 15 min');
    expect(durationLabel(null)).toBe('—');
  });
});
