import type { Command } from 'commander';
import { rmSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { ADHD_DEV_HOME } from '../../core/paths.js';

export function register(program: Command): void {
  program
    .command('reset')
    .description('Reset ADHD-Dev by removing ~/.adhd-dev/ (use --force to confirm)')
    .option('--force', 'Actually perform the reset')
    .action((options: { force?: boolean }) => {
      if (!options.force) {
        console.log(
          chalk.yellow('Warning: This will delete all ADHD-Dev data including config, stats, and logs.'),
        );
        console.log(chalk.dim(`Directory: ${ADHD_DEV_HOME}`));
        console.log('');
        console.log(chalk.bold('Run with --force to confirm:'));
        console.log(chalk.dim('  adhd-dev reset --force'));
        return;
      }

      if (!existsSync(ADHD_DEV_HOME)) {
        console.log(chalk.dim('~/.adhd-dev/ does not exist. Nothing to reset.'));
        return;
      }

      try {
        rmSync(ADHD_DEV_HOME, { recursive: true, force: true });
        console.log(chalk.red(`Removed ${ADHD_DEV_HOME}`));
        console.log(chalk.dim('Run `adhd-dev init` to reinitialize.'));
      } catch (err) {
        console.error(chalk.red(`Failed to remove ${ADHD_DEV_HOME}: ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
