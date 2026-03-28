import type { Command } from 'commander';
import { existsSync, writeFileSync } from 'node:fs';
import chalk from 'chalk';
import { ensureHomeDir, CONFIG_FILE, ADHD_DEV_HOME } from '../../core/paths.js';
import { getDefaultConfig } from '../../core/config.js';
import { generateZshIntegration, generateBashIntegration } from '../../services/shell-integrator.js';

export function register(program: Command): void {
  program
    .command('init')
    .description('Initialize ADHD-Dev home directory and configuration')
    .option('--full', 'Also print shell integration snippets')
    .action((options: { full?: boolean }) => {
      ensureHomeDir();

      if (!existsSync(CONFIG_FILE)) {
        const defaults = getDefaultConfig();
        writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2), 'utf8');
        console.log(chalk.green(`Created default config at ${CONFIG_FILE}`));
      } else {
        console.log(chalk.dim(`Config already exists at ${CONFIG_FILE}`));
      }

      console.log(chalk.green(`Initialized ADHD-Dev at ${ADHD_DEV_HOME}`));

      if (options.full) {
        console.log('');
        console.log(chalk.bold('Shell Integration'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log('');
        console.log(chalk.bold('Add to ~/.zshrc:'));
        console.log(chalk.dim('─'.repeat(40)));
        console.log(generateZshIntegration());
        console.log('');
        console.log(chalk.bold('Add to ~/.bashrc:'));
        console.log(chalk.dim('─'.repeat(40)));
        console.log(generateBashIntegration());
      }
    });
}
