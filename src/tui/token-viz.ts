import chalk from 'chalk';
import { LEVEL_THRESHOLDS, LEVEL_NAMES, LEVEL_COLORS } from '../core/constants.js';
import type { AgentInfo } from '../core/types.js';

/**
 * Format a token count for display.
 * 0-999: "500", 1000-999999: "44.9K", 1000000+: "1.2M"
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return `${tokens}`;
}

/**
 * Render a level progress bar for an agent.
 * Format: "Lv3 Adult ██████░░░ 44.9K"
 */
export function renderLevelBar(agent: AgentInfo, width: number): string {
  const level = Math.min(agent.level, LEVEL_THRESHOLDS.length - 1);
  const levelName = LEVEL_NAMES[level - 1] ?? LEVEL_NAMES[0]!;
  const colorName = LEVEL_COLORS[level - 1] ?? LEVEL_COLORS[0]!;

  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]!;

  const prefix = `Lv${level} ${levelName} `;
  const tokenStr = ` ${formatTokenCount(agent.tokenUsage)}`;
  const barWidth = Math.max(4, width - prefix.length - tokenStr.length);

  // Calculate progress ratio
  const range = nextThreshold - currentThreshold;
  const progress = range > 0
    ? Math.min(1, (agent.tokenUsage - currentThreshold) / range)
    : 1;

  const filled = Math.round(progress * barWidth);
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const colored = (text: string): string => {
    switch (colorName) {
      case 'gray':   return chalk.gray(text);
      case 'cyan':   return chalk.cyan(text);
      case 'green':  return chalk.green(text);
      case 'yellow': return chalk.yellow(text);
      case 'red':    return chalk.red(text);
      default:       return text;
    }
  };

  return prefix + colored(bar) + tokenStr;
}

/**
 * Render a token delta indicator.
 * > 100: chalk.green(" +1.2K↑")
 * < -100: chalk.red(" -500↓")
 * else: empty string
 */
export function renderTokenDelta(delta: number): string {
  if (delta > 100) {
    return chalk.green(` +${formatTokenCount(delta)}↑`);
  }
  if (delta < -100) {
    return chalk.red(` -${formatTokenCount(Math.abs(delta))}↓`);
  }
  return '';
}

/**
 * Render a horizontal bar chart of token usage per agent.
 * Each line: "project-name  ██████████  44.9K"
 */
export function renderTokenHistogram(agents: AgentInfo[], width: number): string[] {
  if (agents.length === 0) return [];

  const maxTokens = Math.max(...agents.map((a) => a.tokenUsage), 1);
  const maxNameLen = Math.max(...agents.map((a) => a.projectName.length));
  const tokenStrWidth = 6; // e.g. "44.9K"
  const barWidth = Math.max(4, width - maxNameLen - tokenStrWidth - 4);

  return agents.map((agent) => {
    const name = agent.projectName.padEnd(maxNameLen, ' ');
    const filled = Math.round((agent.tokenUsage / maxTokens) * barWidth);
    const empty = barWidth - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const tokenStr = formatTokenCount(agent.tokenUsage).padStart(tokenStrWidth, ' ');
    return `${name}  ${bar}  ${tokenStr}`;
  });
}
