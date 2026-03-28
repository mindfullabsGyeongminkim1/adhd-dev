// Screen management
export const ENTER_ALT_SCREEN = '\x1b[?1049h';
export const EXIT_ALT_SCREEN = '\x1b[?1049l';
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';
export const MOVE_HOME = '\x1b[H';
export const CLEAR_SCREEN = '\x1b[2J';
export const RESET = '\x1b[0m';

// Cursor positioning
export function moveTo(row: number, col: number): string {
  return `\x1b[${row};${col}H`;
}

// Truecolor helpers
export function fgRgb(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function bgRgb(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}

// Box drawing (Unicode)
export function boxTop(width: number, title?: string): string {
  if (title) {
    // ┌── title ──...─┐
    const inner = width - 2; // exclude corner chars
    const titleStr = ` ${title} `;
    const remaining = inner - titleStr.length - 2; // 2 for the '──' before title
    const leftDashes = '──';
    const rightDashes = remaining > 0 ? '─'.repeat(remaining) : '';
    return `┌${leftDashes}${titleStr}${rightDashes}┐`;
  }
  return `┌${'─'.repeat(width - 2)}┐`;
}

export function boxBottom(width: number): string {
  return `└${'─'.repeat(width - 2)}┘`;
}

export function boxMiddle(width: number): string {
  return `├${'─'.repeat(width - 2)}┤`;
}

export function boxSide(): string {
  return '│';
}

export function horizontalLine(width: number): string {
  return '─'.repeat(width);
}
