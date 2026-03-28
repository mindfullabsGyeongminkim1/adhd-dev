import type { Command } from 'commander';
import { startDashboard } from '../../tui/dashboard.js';

export function register(program: Command): void {
  program
    .command('dash')
    .description('Open the interactive TUI dashboard')
    .action(() => {
      void startDashboard();
    });
}
