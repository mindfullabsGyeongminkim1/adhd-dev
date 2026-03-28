import type { Command } from 'commander';
import chalk from 'chalk';
import { getTodayStats } from '../../services/stats-aggregator.js';

export function register(program: Command): void {
  program
    .command('today')
    .description("Show today's focus stats")
    .action(() => {
      const stats = getTodayStats();
      const hours = Math.floor(stats.focusMinutes / 60);
      const mins = stats.focusMinutes % 60;
      const focusLabel =
        hours > 0 ? `${hours}h ${mins}m` : `${stats.focusMinutes}m`;

      console.log(chalk.bold("Today's Focus Stats"));
      console.log(chalk.gray('─'.repeat(24)));
      console.log(`Focus time:         ${chalk.cyan(focusLabel)}`);
      console.log(`Completed sessions: ${chalk.green(String(stats.completedSessions))}`);
      console.log(chalk.gray(`Date: ${stats.date}`));
    });
}
