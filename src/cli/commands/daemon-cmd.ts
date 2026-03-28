import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import chalk from 'chalk';
import { PID_FILE } from '../../core/paths.js';
import { isDaemonRunning } from '../ipc-client.js';

function getDaemonPath(): string {
  // Resolve daemon entry relative to CLI bundle (dist/cli/index.js -> dist/daemon/index.js)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  // In bundled mode: dist/cli/index.js → sibling dir dist/daemon/index.js
  return join(__dirname, '..', 'daemon', 'index.js');
}

export function register(program: Command): void {
  const daemonCmd = program
    .command('daemon <action>')
    .description('Manage the ADHD-Dev background daemon (start|stop|status)')
    .action(async (action: string) => {
      if (action === 'start') {
        const alreadyRunning = await isDaemonRunning();
        if (alreadyRunning) {
          console.log(chalk.yellow('Daemon is already running.'));
          return;
        }

        const daemonPath = getDaemonPath();
        if (!existsSync(daemonPath)) {
          console.error(chalk.red(`Daemon entry not found at ${daemonPath}`));
          console.error(chalk.dim('Run `npm run build` first.'));
          process.exit(1);
        }

        const child = spawn(process.execPath, [daemonPath], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        console.log(chalk.green(`Daemon started (PID ${child.pid ?? 'unknown'})`));

      } else if (action === 'stop') {
        if (!existsSync(PID_FILE)) {
          console.log(chalk.dim('Daemon is not running (no PID file).'));
          return;
        }

        try {
          const pidStr = readFileSync(PID_FILE, 'utf8').trim();
          const pid = parseInt(pidStr, 10);
          if (isNaN(pid)) {
            console.error(chalk.red('Invalid PID in PID file.'));
            process.exit(1);
          }
          process.kill(pid, 'SIGTERM');
          console.log(chalk.yellow(`Sent SIGTERM to daemon (PID ${pid})`));
        } catch (err) {
          const message = (err as NodeJS.ErrnoException).message;
          if ((err as NodeJS.ErrnoException).code === 'ESRCH') {
            console.log(chalk.dim('Daemon process not found (already stopped).'));
          } else {
            console.error(chalk.red(`Failed to stop daemon: ${message}`));
            process.exit(1);
          }
        }

      } else if (action === 'status') {
        const running = await isDaemonRunning();
        if (running) {
          const pidStr = existsSync(PID_FILE) ? readFileSync(PID_FILE, 'utf8').trim() : '?';
          console.log(`${chalk.green('●')} Daemon running (PID ${pidStr})`);
        } else {
          console.log(`${chalk.dim('○')} Daemon not running`);
        }

      } else {
        console.error(chalk.red(`Unknown action: ${action}. Use start, stop, or status.`));
        process.exit(1);
      }
    });
}
