import { describe, it, expect } from 'vitest';
import {
  charWidth,
  displayWidth,
  stripAnsi,
  truncateToWidth,
  padToWidth,
} from '../../src/tui/text-utils.js';

describe('charWidth', () => {
  it('returns 1 for ASCII characters', () => {
    expect(charWidth('a'.codePointAt(0)!)).toBe(1);
  });

  it('returns 2 for Hangul syllables (CJK)', () => {
    expect(charWidth('안'.codePointAt(0)!)).toBe(2);
  });

  it('returns 2 for CJK Unified Ideographs', () => {
    expect(charWidth(0x4e00)).toBe(2);
    expect(charWidth(0x9fff)).toBe(2);
  });

  it('returns 2 for Hangul Jamo', () => {
    expect(charWidth(0x1100)).toBe(2);
    expect(charWidth(0x115f)).toBe(2);
  });

  it('returns 1 for Latin characters', () => {
    expect(charWidth('z'.codePointAt(0)!)).toBe(1);
    expect(charWidth('Z'.codePointAt(0)!)).toBe(1);
  });

  it('returns 1 for digits', () => {
    expect(charWidth('0'.codePointAt(0)!)).toBe(1);
    expect(charWidth('9'.codePointAt(0)!)).toBe(1);
  });
});

describe('displayWidth', () => {
  it('returns 5 for "hello"', () => {
    expect(displayWidth('hello')).toBe(5);
  });

  it('returns 4 for "안녕" (two Hangul = 2 each)', () => {
    expect(displayWidth('안녕')).toBe(4);
  });

  it('returns 6 for "hi안녕" (2 ASCII + 4 CJK)', () => {
    expect(displayWidth('hi안녕')).toBe(6);
  });

  it('returns 3 for ANSI-colored "red" (ANSI sequences stripped)', () => {
    expect(displayWidth('\x1b[31mred\x1b[0m')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(displayWidth('')).toBe(0);
  });
});

describe('stripAnsi', () => {
  it('removes ANSI color codes', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
  });

  it('handles string without ANSI codes unchanged', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });

  it('handles multiple ANSI codes', () => {
    expect(stripAnsi('\x1b[1m\x1b[32mbold green\x1b[0m')).toBe('bold green');
  });
});

describe('truncateToWidth', () => {
  it('truncates Korean text with ellipsis to fit within width', () => {
    // '안녕하세요' = 10 display width (5 chars × 2)
    // maxWidth=6: '안녕' (4) + '…' (1) = 5, fits; '안녕하' (6) + '…' (1) = 7, doesn't
    const result = truncateToWidth('안녕하세요', 6);
    expect(result).toBe('안녕…');
  });

  it('does not truncate if already within width', () => {
    expect(truncateToWidth('hi', 5)).toBe('hi');
    expect(truncateToWidth('hello', 5)).toBe('hello');
  });

  it('truncates ASCII text', () => {
    const result = truncateToWidth('abcdefgh', 5);
    expect(result).toBe('abcd…');
  });

  it('uses custom ellipsis', () => {
    const result = truncateToWidth('abcdefgh', 6, '...');
    expect(result).toBe('abc...');
  });
});

describe('padToWidth', () => {
  it('pads "hi" to width 5 with spaces', () => {
    expect(padToWidth('hi', 5)).toBe('hi   ');
  });

  it('does not pad if already at width', () => {
    expect(padToWidth('hello', 5)).toBe('hello');
  });

  it('does not truncate if wider than width', () => {
    expect(padToWidth('hello world', 5)).toBe('hello world');
  });

  it('uses custom pad character', () => {
    expect(padToWidth('hi', 5, '-')).toBe('hi---');
  });
});
