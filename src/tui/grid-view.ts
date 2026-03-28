import chalk from 'chalk';
import { renderCard } from './card-renderer.js';
import { horizontalLine } from './ansi.js';
import type { AgentInfo, TimerState, DayStats, PromptState } from '../core/types.js';

/**
 * Get card dimensions based on current terminal width.
 */
export function getCardDimensions(): { inner: number; outer: number; columns: number } {
  const cols = process.stdout.columns ?? 80;

  let columns: number;
  let inner: number;

  if (cols >= 90) {
    columns = 2;
    inner = Math.floor((cols - 6) / 2) - 2;
    inner = Math.max(28, Math.min(60, inner));
  } else {
    columns = 1;
    inner = cols - 6;
    inner = Math.max(28, Math.min(60, inner));
  }

  return { inner, outer: inner + 2, columns };
}

function formatTimer(timer: TimerState | null): string {
  if (!timer) return '';
  if (!timer.running) return chalk.dim(' [timer stopped]');

  const elapsed = Date.now() - timer.startedAt;
  const remaining = Math.max(0, timer.durationMs - elapsed);
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1000);
  const str = `${mins}:${secs.toString().padStart(2, '0')}`;

  return timer.flowMode
    ? chalk.cyan(` ⏱ ${str} [flow]`)
    : chalk.green(` ⏱ ${str}`);
}

function formatDopamineState(prompt: PromptState | null): string {
  if (!prompt) return '';
  return chalk.dim(` ${prompt.timeOfDay} ${prompt.warmth}`);
}

/**
 * Render the full grid layout as a string.
 */
export function renderGridView(
  agents: AgentInfo[],
  timer: TimerState | null,
  stats: DayStats,
  promptState: PromptState | null,
  frame: number,
  tokenDeltas: Map<string, number>,
  flashSet: Set<string>,
): string {
  const { inner, columns } = getCardDimensions();
  const cols = process.stdout.columns ?? 80;
  const lines: string[] = [];

  // Header
  const dopamine = formatDopamineState(promptState);
  const timerStr = formatTimer(timer);
  const headerLeft = chalk.bold('🦞 ADHD-Dev Agent Dashboard');
  const headerLine = `${headerLeft}${dopamine}${timerStr}`;
  lines.push(headerLine);
  lines.push(horizontalLine(Math.min(cols, 80)));
  lines.push('');

  // Cards in columns
  if (agents.length === 0) {
    lines.push(chalk.dim('  No active Claude Code sessions found.'));
    lines.push('');
  } else {
    const cardLines: string[][] = agents.map((agent, i) =>
      renderCard(agent, i, frame, inner, flashSet.has(agent.sessionId)),
    );

    if (columns === 2) {
      // Pair up cards
      for (let i = 0; i < cardLines.length; i += 2) {
        const left = cardLines[i]!;
        const right = cardLines[i + 1];
        const maxH = right ? Math.max(left.length, right.length) : left.length;

        for (let row = 0; row < maxH; row++) {
          const leftLine = (left[row] ?? '').padEnd(inner + 2);
          if (right) {
            const rightLine = right[row] ?? '';
            lines.push(`  ${leftLine}  ${rightLine}`);
          } else {
            lines.push(`  ${leftLine}`);
          }
        }
        lines.push('');
      }
    } else {
      for (const card of cardLines) {
        for (const line of card) {
          lines.push(`  ${line}`);
        }
        lines.push('');
      }
    }
  }

  // Footer separator
  lines.push(horizontalLine(Math.min(cols, 80)));

  // Stats line
  const statsStr = chalk.dim(
    `Today: ${stats.focusMinutes}min focus | ${stats.completedSessions} sessions`,
  );
  const hints = chalk.dim('[q]uit [r]efresh [t]imer [1-5]detail');
  const footerPad = Math.max(0, Math.min(cols, 80) - statsStr.length - hints.length);
  lines.push(`${statsStr}${' '.repeat(footerPad)}${hints}`);

  return lines.join('\n');
}
