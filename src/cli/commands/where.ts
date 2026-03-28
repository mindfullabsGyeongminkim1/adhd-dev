import type { Command } from 'commander';
import chalk from 'chalk';
import { discoverAgents } from '../../services/agent-tracker.js';

function truncateExchange(text: string, maxLen = 200): string {
  if (!text) return chalk.dim('(no recent activity)');
  const single = text.replace(/\n/g, ' ').trim();
  if (single.length <= maxLen) return single;
  return single.slice(0, maxLen - 1) + '…';
}

export function register(program: Command): void {
  program
    .command('where')
    .description('Show working agents and their last exchange context')
    .option('--brief', 'Only show project names')
    .action((options: { brief?: boolean }) => {
      const agents = discoverAgents();
      const working = agents.filter((a) => a.state === 'working' || a.state === 'idle');

      if (working.length === 0) {
        console.log(chalk.dim('No active sessions found. 어디까지 했더라?'));
        return;
      }

      if (options.brief) {
        for (const agent of working) {
          console.log(chalk.bold(agent.projectName));
        }
        return;
      }

      console.log(chalk.bold('어디까지 했더라? (Where were we?)'));
      console.log('');

      for (const agent of working) {
        const stateColor = agent.state === 'working' ? chalk.green : chalk.yellow;
        const stateSymbol = agent.state === 'working' ? '●' : '◐';

        console.log(
          `${stateColor(stateSymbol)} ${chalk.bold(agent.projectName)}  ${chalk.dim(agent.cwd)}`
        );
        console.log(`   ${truncateExchange(agent.lastExchange)}`);
        console.log('');
      }
    });
}
