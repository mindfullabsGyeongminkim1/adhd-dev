/**
 * Returns the display width of a Unicode code point.
 * Returns 2 for CJK/fullwidth characters, 1 for everything else.
 */
export function charWidth(code: number): number {
  if (
    (code >= 0x1100 && code <= 0x115f) ||   // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) ||   // CJK Radicals
    (code >= 0x3040 && code <= 0x33bf) ||   // Hiragana/Katakana
    (code >= 0x3400 && code <= 0x4dbf) ||   // CJK Ext A
    (code >= 0x4e00 && code <= 0x9fff) ||   // CJK Unified
    (code >= 0xac00 && code <= 0xd7af) ||   // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) ||   // CJK Compat
    (code >= 0xfe30 && code <= 0xfe6f) ||   // CJK Compat Forms
    (code >= 0xff01 && code <= 0xff60) ||   // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) ||   // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2fa1f)    // CJK Extensions
  ) {
    return 2;
  }
  return 1;
}

/**
 * Remove ANSI escape sequences from a string.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Calculate the display width of a string, ignoring ANSI escape sequences.
 */
export function displayWidth(str: string): number {
  const clean = stripAnsi(str);
  let width = 0;
  for (const char of clean) {
    const code = char.codePointAt(0) ?? 0;
    width += charWidth(code);
  }
  return width;
}

/**
 * Truncate a string to fit within maxWidth display columns.
 * Appends ellipsis if truncated (default: '…').
 */
export function truncateToWidth(str: string, maxWidth: number, ellipsis = '…'): string {
  if (displayWidth(str) <= maxWidth) return str;

  const ellipsisWidth = displayWidth(ellipsis);
  let width = 0;
  let result = '';

  for (const char of str) {
    const code = char.codePointAt(0) ?? 0;
    const cw = charWidth(code);
    if (width + cw + ellipsisWidth > maxWidth) break;
    result += char;
    width += cw;
  }

  return result + ellipsis;
}

/**
 * Pad a string on the right with spaces to reach the given display width.
 */
export function padToWidth(str: string, width: number, char = ' '): string {
  const current = displayWidth(str);
  const needed = width - current;
  if (needed <= 0) return str;
  return str + char.repeat(needed);
}

/**
 * Center a string within the given display width, padding with spaces.
 */
export function centerToWidth(str: string, width: number): string {
  const current = displayWidth(str);
  const needed = width - current;
  if (needed <= 0) return str;
  const left = Math.floor(needed / 2);
  const right = needed - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}
