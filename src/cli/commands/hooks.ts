import type { Command } from 'commander';
import chalk from 'chalk';
import { installHooks, uninstallHooks } from '../../services/hook-installer.js';

export function register(program: Command): void {
  program
    .command('install-hooks')
    .description('Install ADHD-Dev Claude Code hooks into ~/.claude/settings.json')
    .action(() => {
      const result = installHooks();
      if (result.success) {
        if (result.backedUp) {
          console.log(chalk.dim('Backed up existing settings.json'));
        }
        console.log(chalk.green('Hooks installed successfully.'));
      } else {
        console.error(chalk.red('Failed to install hooks.'));
        process.exit(1);
      }
    });

  program
    .command('uninstall-hooks')
    .description('Remove ADHD-Dev hooks from ~/.claude/settings.json')
    .action(() => {
      const result = uninstallHooks();
      if (result.success) {
        console.log(chalk.yellow('Hooks removed from settings.json.'));
      } else {
        console.error(chalk.red('Failed to uninstall hooks.'));
        process.exit(1);
      }
    });
}
