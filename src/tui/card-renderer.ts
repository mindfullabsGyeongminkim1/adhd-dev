import chalk from 'chalk';
import { getCrawfishArt } from './crawfish-art.js';
import { renderLevelBar, renderTokenDelta } from './token-viz.js';
import { truncateToWidth, displayWidth, padToWidth } from './text-utils.js';
import { boxTop, boxBottom, boxSide, RESET } from './ansi.js';
import { LEVEL_NAMES } from '../core/constants.js';
import type { AgentInfo } from '../core/types.js';

const STATE_INDICATOR: Record<string, string> = {
  working: chalk.green('●'),
  idle: chalk.yellow('◐'),
  sleeping: chalk.dim('○'),
};

/**
 * Describe the current activity of an agent as a short string.
 */
export function describeActivity(agent: AgentInfo, maxWidth: number): string {
  switch (agent.state) {
    case 'sleeping':
      return '휴식 중...';
    case 'idle':
      return '대기 중...';
    default: {
      // working or complete-like state
      if (!agent.lastExchange) return '작업 완료!';
      return summarizeExchange(agent.lastExchange, maxWidth);
    }
  }
}

/**
 * Summarize a raw exchange text: find first meaningful line, strip markdown,
 * and truncate to CJK-aware display width.
 */
export function summarizeExchange(text: string, maxLen: number): string {
  const lines = text.split('\n');

  let meaningful = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('##')) continue;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.startsWith('|')) continue;
    meaningful = trimmed;
    break;
  }

  if (!meaningful) return '';

  // Strip markdown: **, `, |, #
  const stripped = meaningful
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\|/g, '')
    .replace(/#+\s?/g, '');

  return truncateToWidth(stripped.trim(), maxLen, '…');
}

/**
 * Render a bordered card for an agent.
 * Returns an array of lines forming the card.
 */
export function renderCard(
  agent: AgentInfo,
  _index: number,
  frame: number,
  innerWidth: number,
  flash: boolean,
): string[] {
  const outerWidth = innerWidth + 2;
  const levelIdx = Math.max(0, agent.level - 1);
  const levelName = LEVEL_NAMES[levelIdx] ?? LEVEL_NAMES[0]!;

  const borderColor = flash
    ? (s: string) => chalk.yellow(s)
    : (s: string) => s;

  // Header line
  const titleText = agent.projectName;
  const maxTitleLen = innerWidth - 4; // leave room for box chars
  const truncatedTitle = displayWidth(titleText) > maxTitleLen
    ? truncateToWidth(titleText, maxTitleLen, '…')
    : titleText;

  const lines: string[] = [];

  // Top border with title
  const topLine = boxTop(outerWidth, truncatedTitle);
  lines.push(borderColor(topLine));

  // Crawfish art lines
  const artLines = getCrawfishArt(agent.level, agent.state, frame);
  for (const artLine of artLines) {
    const artWidth = displayWidth(artLine);
    const pad = innerWidth - artWidth;
    const leftPad = Math.floor(pad / 2);
    const rightPad = pad - leftPad;
    const padded = ' '.repeat(Math.max(0, leftPad)) + artLine + ' '.repeat(Math.max(0, rightPad));
    lines.push(borderColor(boxSide()) + padded + borderColor(boxSide()));
  }

  // Level bar
  const levelBarStr = renderLevelBar(agent, innerWidth - 1);
  const levelBarPadded = padToWidth(levelBarStr, innerWidth);
  lines.push(borderColor(boxSide()) + levelBarPadded + borderColor(boxSide()));

  // Activity line
  const indicator = STATE_INDICATOR[agent.state] ?? STATE_INDICATOR['idle']!;
  const maxActivityWidth = innerWidth - 3; // 2 for indicator + space
  const activity = describeActivity(agent, maxActivityWidth);
  const activityLine = padToWidth(`${indicator} ${activity}`, innerWidth);
  lines.push(borderColor(boxSide()) + activityLine + borderColor(boxSide()));

  // Bottom border
  lines.push(borderColor(boxBottom(outerWidth)));

  return lines;
}
