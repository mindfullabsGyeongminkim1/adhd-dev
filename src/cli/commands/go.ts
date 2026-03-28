import type { Command } from 'commander';
import { discoverAgents } from '../../services/agent-tracker.js';

export function register(program: Command): void {
  program
    .command('go <session-name>')
    .description('Output cd command for a session (designed to be eval\'d by shell)')
    .action((sessionName: string) => {
      const agents = discoverAgents();
      const lower = sessionName.toLowerCase();

      const match = agents.find(
        (a) =>
          a.projectName.toLowerCase().includes(lower) ||
          a.cwd.toLowerCase().includes(lower),
      );

      if (!match) {
        // Output nothing — shell wrapper will handle silently
        process.exit(1);
      }

      // Output the cd command to stdout for eval
      process.stdout.write(`cd ${JSON.stringify(match.cwd)}`);
    });
}
