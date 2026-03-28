import type { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { PROMPT_STATE_FILE } from '../../core/paths.js';
import type { PromptState } from '../../core/types.js';

function buildPromptString(state: PromptState): string {
  const parts: string[] = [];

  // Timer takes priority
  if (state.timer) {
    parts.push(state.timer);
  }

  // Badge (momentum)
  if (state.badge !== null) {
    parts.push(String(state.badge));
  }

  // Return-to indicator
  if (state.returnTo) {
    parts.push(`← ${state.returnTo}`);
  }

  // Time of day + warmth if no other info
  if (parts.length === 0) {
    parts.push(`${state.timeOfDay} ${state.warmth}`);
  }

  return parts.join(' | ');
}

export function register(program: Command): void {
  program
    .command('prompt-status')
    .description('Output prompt status string for PS1/RPROMPT integration')
    .action(() => {
      if (!existsSync(PROMPT_STATE_FILE)) {
        // Graceful: empty string — no newline
        process.stdout.write('');
        return;
      }

      try {
        const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
        const state = JSON.parse(raw) as PromptState;
        process.stdout.write(buildPromptString(state));
      } catch {
        // Graceful: empty string on parse error
        process.stdout.write('');
      }
    });
}
