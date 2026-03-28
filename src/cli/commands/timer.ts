import type { Command } from 'commander';
import chalk from 'chalk';
import {
  startTimer,
  stopTimer,
  getTimerStatus,
  applyPreset,
  getRemainingMs,
  isTimerComplete,
} from '../../services/timer-engine.js';
import { TIMER_PRESETS } from '../../core/constants.js';

function formatDuration(ms: number): string {
  const totalSeconds = Math.ceil(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function renderProgressBar(remainingMs: number, totalMs: number, width = 20): string {
  const ratio = Math.max(0, Math.min(1, 1 - remainingMs / totalMs));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return '[' + chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ']';
}

export function register(program: Command): void {
  const timer = program.command('timer').description('Manage focus timer');

  timer
    .command('start [minutes]')
    .description('Start a focus timer (default: 25 minutes)')
    .action((minutesArg: string | undefined) => {
      const minutes = minutesArg !== undefined ? parseInt(minutesArg, 10) : undefined;
      if (minutes !== undefined && (isNaN(minutes) || minutes <= 0)) {
        console.error(chalk.red('Error: minutes must be a positive number'));
        process.exit(1);
      }
      const state = startTimer(minutes);
      const min = Math.round(state.durationMs / 60000);
      console.log(chalk.green(`Timer started: ${min} minute focus session`));
      console.log(chalk.gray(`Preset: ${state.preset}`));
    });

  timer
    .command('stop')
    .description('Stop the running timer')
    .action(() => {
      const state = stopTimer();
      console.log(chalk.yellow('Timer stopped.'));
    });

  timer
    .command('status')
    .description('Show remaining time and progress')
    .action(() => {
      const state = getTimerStatus();
      if (!state) {
        console.log(chalk.gray('No timer found. Run `adhd-dev timer start` to begin.'));
        return;
      }
      if (!state.running) {
        console.log(chalk.gray('Timer is stopped.'));
        return;
      }
      if (isTimerComplete()) {
        console.log(chalk.red('Timer complete! Take a break.'));
        return;
      }
      const remaining = getRemainingMs();
      const bar = renderProgressBar(remaining, state.durationMs);
      const pct = Math.round((1 - remaining / state.durationMs) * 100);
      console.log(`${bar} ${chalk.cyan(formatDuration(remaining))} remaining (${pct}%)`);
      console.log(chalk.gray(`Preset: ${state.preset} | Flow mode: ${state.flowMode ? chalk.green('ON') : 'OFF'}`));
    });

  timer
    .command('preset <name>')
    .description(`Apply a timer preset (${Object.keys(TIMER_PRESETS).join(', ')})`)
    .action((name: string) => {
      try {
        const state = applyPreset(name);
        const min = Math.round(state.durationMs / 60000);
        console.log(chalk.green(`Preset "${name}" applied: ${min} minute focus session started`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });
}
