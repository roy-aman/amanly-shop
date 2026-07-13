import { describe, expect, it } from 'vitest';
import { money, formatDate, formatDateTime, titleCase, timeAgo } from './format';

describe('money', () => {
  it('returns an em dash for null/undefined/NaN', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
    expect(money(Number.NaN)).toBe('—');
  });

  it('formats zero as a real amount (0 is not treated as missing)', () => {
    const out = money(0, 'USD');
    expect(out).not.toBe('—');
    expect(out).toMatch(/0[.,]00/);
  });

  it('formats a positive amount with the currency style', () => {
    // Compare against Intl directly to stay locale-independent across machines.
    const expected = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.5);
    expect(money(1234.5, 'USD')).toBe(expected);
  });

  it('handles negative amounts', () => {
    const out = money(-5, 'USD');
    expect(out).not.toBe('—');
    expect(out).toMatch(/5[.,]00/);
  });

  it('honours a non-default currency', () => {
    const expected = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(10);
    expect(money(10, 'EUR')).toBe(expected);
  });

  it('falls back to a plain number + code for an invalid currency code', () => {
    // "BADCODE" is not a well-formed 3-letter code, so Intl throws and we fall back.
    expect(money(10, 'BADCODE')).toBe('10.00 BADCODE');
  });
});

describe('formatDate', () => {
  it('returns an em dash for empty/invalid input', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('formats a valid ISO date', () => {
    const out = formatDate('2026-07-14');
    expect(out).not.toBe('—');
    expect(out).toContain('2026');
  });
});

describe('formatDateTime', () => {
  it('returns an em dash for empty/invalid input', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('nonsense')).toBe('—');
  });

  it('formats a valid ISO datetime', () => {
    const out = formatDateTime('2026-07-14T09:30:00Z');
    expect(out).not.toBe('—');
    expect(out).toContain('2026');
  });
});

describe('titleCase', () => {
  it('title-cases space-separated words', () => {
    expect(titleCase('hello world')).toBe('Hello World');
  });

  it('splits on underscores and collapses repeated separators', () => {
    expect(titleCase('SNAKE_case_here')).toBe('Snake Case Here');
    expect(titleCase('multiple   spaces')).toBe('Multiple Spaces');
  });

  it('lowercases an all-caps enum value', () => {
    expect(titleCase('PENDING')).toBe('Pending');
  });

  it('returns empty string unchanged', () => {
    expect(titleCase('')).toBe('');
  });
});

describe('timeAgo', () => {
  it('returns an em dash for empty/invalid input', () => {
    expect(timeAgo(null)).toBe('—');
    expect(timeAgo('bad')).toBe('—');
  });

  it('reports "just now" for the current instant', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
  });

  it('reports minutes, hours and days for recent times', () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe('3h ago');
    expect(timeAgo(new Date(Date.now() - 2 * 86_400_000).toISOString())).toBe('2d ago');
  });

  it('falls back to an absolute date beyond ~30 days', () => {
    const long = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const out = timeAgo(long);
    expect(out).not.toMatch(/ago$/);
    expect(out).not.toBe('just now');
  });
});
