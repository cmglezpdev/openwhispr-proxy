import { describe, expect, it } from 'vitest';
import { audioDuration, compactWords, money } from './format';

describe('summary formats', () => {
  it('rounds card spend to cents while retaining precision elsewhere', () => {
    expect(money(4.119862, 2)).toBe('$4.12');
    expect(money(4, 2)).toBe('$4.00');
    expect(money(0.0001)).toBe('$0.0001');
    expect(money(null, 2)).toBe('No data');
  });
  it('formats automatic time with carries at minute and hour boundaries', () => {
    expect(audioDuration(0)).toBe('0 s');
    expect(audioDuration(45)).toBe('45 s');
    expect(audioDuration(59.9)).toBe('1 min');
    expect(audioDuration(60)).toBe('1 min');
    expect(audioDuration(2209.6)).toBe('36 min 50 s');
    expect(audioDuration(3599.9)).toBe('1 h');
    expect(audioDuration(3600)).toBe('1 h');
    expect(audioDuration(8100)).toBe('2 h 15 min');
    expect(audioDuration(132576)).toBe('36 h 50 min');
    expect(audioDuration(null)).toBe('No data');
  });
  it('allows viewing decimal totals in either unit', () => {
    expect(audioDuration(132576, 'minutes')).toBe('2,209.6 min');
    expect(audioDuration(132576, 'hours')).toBe('36.83 h');
  });
});

describe('compact word counts', () => {
  it('keeps small counts exact and abbreviates thousands as whole K', () => {
    expect(compactWords(0)).toBe('0');
    expect(compactWords(999)).toBe('999');
    expect(compactWords(1000)).toBe('1K');
    expect(compactWords(2000)).toBe('2K');
    expect(compactWords(312172)).toBe('312K');
    expect(compactWords(312999)).toBe('312K');
  });
});
