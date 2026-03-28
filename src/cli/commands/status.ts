import type { Command } from 'commander';
import chalk from 'chalk';
import { discoverAgents } from '../../services/agent-tracker.js';
import { LEVEL_NAMES } from '../../core/constants.js';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function truncateExchange(text: string, maxLen = 40): string {
  if (!text) return '';
  const single = text.replace(/\n/g, ' ').trim();
  if (single.length <= maxLen) return single;
  return single.slice(0, maxLen - 1) + '…';
}

export function register(program: Command): void {
  program
    .command('status')
    .description('Show all discovered Claude agents and their current state')
    .action(() => {
      const agents = discoverAgents();

      if (agents.length === 0) {
        console.log(chalk.dim('No active Claude sessions found.'));
        return;
      }

      let workingCount = 0;
      let idleCount = 0;
      let sleepingCount = 0;

      for (const agent of agents) {
        let indicator: string;

        if (agent.state === 'working') {
          indicator = chalk.green('●');
          workingCount++;
        } else if (agent.state === 'idle') {
          indicator = chalk.yellow('◐');
          idleCount++;
        } else {
          indicator = chalk.dim('○');
          sleepingCount++;
        }

        const levelName = LEVEL_NAMES[agent.level - 1] ?? 'Unknown';
        const tokens = formatTokens(agent.tokenUsage);
        const exchange = truncateExchange(agent.lastExchange);
        const exchangePart = exchange ? chalk.dim(`"${exchange}"`) : '';

        console.log(
          `${indicator} ${chalk.bold(agent.projectName.padEnd(20))} Lv${agent.level} ${levelName.padEnd(8)} ${tokens.padStart(8)} tokens  ${exchangePart}`
        );
      }

      console.log('');
      console.log(
        `${chalk.green(workingCount)} active, ${chalk.yellow(idleCount)} idle, ${chalk.dim(sleepingCount)} sleeping`
      );
    });
}
