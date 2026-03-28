import type { Command } from 'commander';
import chalk from 'chalk';
import { isFlowMode, setFlowMode } from '../../services/flow-protection.js';

export function register(program: Command): void {
  program
    .command('flow <state>')
    .description('Toggle flow/DND mode on or off')
    .action((state: string) => {
      if (state !== 'on' && state !== 'off') {
        console.error(chalk.red('Error: argument must be "on" or "off"'));
        process.exit(1);
      }
      const enabled = state === 'on';
      setFlowMode(enabled);
      if (enabled) {
        console.log(chalk.green('Flow mode ON — notifications suppressed.'));
      } else {
        console.log(chalk.yellow('Flow mode OFF — notifications enabled.'));
      }
    });
}
