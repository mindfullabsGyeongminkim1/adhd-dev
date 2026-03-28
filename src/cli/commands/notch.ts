import type { Command } from 'commander';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import chalk from 'chalk';

const NOTCH_PID_FILE = join(homedir(), '.adhd-dev', 'notch.pid');

function getNotchMainPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '..', 'notch', 'main.js');
}

function getElectronPath(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const electronPath = require('electron') as unknown as string;
    return electronPath;
  } catch {
    return null;
  }
}

function isNotchRunning(): { running: boolean; pid: number | null } {
  if (!existsSync(NOTCH_PID_FILE)) return { running: false, pid: null };
  try {
    const pid = parseInt(readFileSync(NOTCH_PID_FILE, 'utf8').trim(), 10);
    if (isNaN(pid)) return { running: false, pid: null };
    process.kill(pid, 0); // just check if process exists
    return { running: true, pid };
  } catch {
    return { running: false, pid: null };
  }
}

export function register(program: Command): void {
  program
    .command('notch [action]')
    .description('Notch crawfish park widget (start|stop|status, default: start)')
    .action((action?: string) => {
      const cmd = action ?? 'start';

      if (cmd === 'stop') {
        const { running, pid } = isNotchRunning();
        if (!running || !pid) {
          console.log(chalk.dim('Notch widget is not running.'));
          return;
        }
        try {
          process.kill(pid, 'SIGTERM');
          console.log(chalk.yellow(`Notch widget stopped (PID ${pid})`));
        } catch (err) {
          console.error(chalk.red(`Failed to stop: ${(err as Error).message}`));
        }
        return;
      }

      if (cmd === 'status') {
        const { running, pid } = isNotchRunning();
        if (running) {
          console.log(`${chalk.green('●')} Notch widget running (PID ${pid})`);
        } else {
          console.log(`${chalk.dim('○')} Notch widget not running`);
        }
        return;
      }

      // ── start ──
      const { running } = isNotchRunning();
      if (running) {
        console.log(chalk.yellow('Notch widget is already running.'));
        return;
      }

      const electronPath = getElectronPath();
      if (!electronPath) {
        console.error(chalk.red('Electron not found.'));
        console.error(chalk.dim('Install it: npm install electron'));
        process.exit(1);
      }

      const notchMain = getNotchMainPath();
      if (!existsSync(notchMain)) {
        console.error(chalk.red(`Notch entry not found at ${notchMain}`));
        console.error(chalk.dim('Run `npm run build` first.'));
        process.exit(1);
      }

      console.log(chalk.green('🦞 Launching Crawfish Park...'));

      const child = spawn(electronPath, [notchMain], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' },
      });
      child.unref();

      setTimeout(() => process.exit(0), 500);
    });
}
