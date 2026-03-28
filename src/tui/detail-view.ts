import chalk from 'chalk';
import { getCrawfishHires } from './crawfish-art.js';
import { renderLevelBar, renderTokenHistogram, formatTokenCount } from './token-viz.js';
import { horizontalLine } from './ansi.js';
import { LEVEL_THRESHOLDS, LEVEL_NAMES } from '../core/constants.js';
import type { AgentInfo } from '../core/types.js';

function formatTimestamp(ms: number): string {
  if (!ms) return 'N/A';
  return new Date(ms).toLocaleString();
}

/**
 * Render a full-width detail view for a single agent.
 */
export function renderDetailView(
  agent: AgentInfo,
  allAgents: AgentInfo[],
  frame: number,
): string {
  const cols = process.stdout.columns ?? 80;
  const lines: string[] = [];

  // Header
  lines.push(chalk.bold(`Detail: ${agent.projectName}`));
  lines.push(horizontalLine(Math.min(cols, 80)));
  lines.push('');

  // Hires crawfish art
  const artLines = getCrawfishHires(agent.level, agent.state, frame);
  for (const line of artLines) {
    lines.push(`  ${line}`);
  }
  lines.push('');

  // Level info
  const levelIdx = Math.max(0, agent.level - 1);
  const levelName = LEVEL_NAMES[levelIdx] ?? LEVEL_NAMES[0]!;
  lines.push(chalk.bold(`  Level ${agent.level} - ${levelName}`));

  // Extended level bar
  const barLine = renderLevelBar(agent, Math.min(cols - 4, 60));
  lines.push(`  ${barLine}`);

  // Progress to next level
  const currentThreshold = LEVEL_THRESHOLDS[levelIdx] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[agent.level] ?? null;
  if (nextThreshold !== null) {
    const toNext = nextThreshold - agent.tokenUsage;
    lines.push(
      chalk.dim(
        `  Next level in: ${formatTokenCount(Math.max(0, toNext))} tokens (${formatTokenCount(nextThreshold)} total)`,
      ),
    );
  } else {
    lines.push(chalk.dim('  Max level reached!'));
  }
  lines.push('');

  // Token histogram
  if (allAgents.length > 0) {
    lines.push(chalk.bold('  Token Usage (all agents):'));
    const histWidth = Math.min(cols - 4, 60);
    const histogram = renderTokenHistogram(allAgents, histWidth);
    for (const hLine of histogram) {
      lines.push(`  ${hLine}`);
    }
    lines.push('');
  }

  // Last exchange
  lines.push(chalk.bold('  Last Exchange:'));
  if (agent.lastExchange) {
    const exchangeLines = agent.lastExchange.split('\n').slice(0, 10);
    for (const eLine of exchangeLines) {
      lines.push(`  ${eLine}`);
    }
  } else {
    lines.push(chalk.dim('  (no exchange recorded)'));
  }
  lines.push('');

  // Timestamps
  lines.push(chalk.dim(`  Last active: ${formatTimestamp(agent.lastActivityAt)}`));
  lines.push(chalk.dim(`  Started:     ${formatTimestamp(agent.startedAt)}`));
  lines.push('');

  // Footer
  lines.push(horizontalLine(Math.min(cols, 80)));
  lines.push(chalk.dim('[b]ack [q]uit'));

  return lines.join('\n');
}
