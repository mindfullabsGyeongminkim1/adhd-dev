import type { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { PROMPT_STATE_FILE } from '../../core/paths.js';
import type { PromptState } from '../../core/types.js';

function buildTmuxString(state: PromptState): string {
  const parts: string[] = [];

  // Timer with tmux green color
  if (state.timer) {
    parts.push(`#[fg=green]${state.timer}#[default]`);
  }

  // Badge with tmux yellow color
  if (state.badge !== null) {
    parts.push(`#[fg=yellow]x${state.badge}#[default]`);
  }

  // Return-to in cyan
  if (state.returnTo) {
    parts.push(`#[fg=cyan]← ${state.returnTo}#[default]`);
  }

  // Time of day + warmth if nothing else
  if (parts.length === 0) {
    parts.push(`#[fg=white,dim]${state.timeOfDay} ${state.warmth}#[default]`);
  }

  return parts.join(' ');
}

export function register(program: Command): void {
  program
    .command('tmux-status')
    .description('Output tmux status-right string with color codes')
    .action(() => {
      if (!existsSync(PROMPT_STATE_FILE)) {
        process.stdout.write('');
        return;
      }

      try {
        const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
        const state = JSON.parse(raw) as PromptState;
        process.stdout.write(buildTmuxString(state));
      } catch {
        process.stdout.write('');
      }
    });
}
