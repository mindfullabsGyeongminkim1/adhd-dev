import type { Command } from 'commander';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import chalk from 'chalk';
import {
  ADHD_DEV_HOME,
  CLAUDE_HOME,
  CLAUDE_SESSIONS_DIR,
  PID_FILE,
} from '../../core/paths.js';
import { isDaemonRunning } from '../ipc-client.js';
import { areHooksInstalled } from '../../services/hook-installer.js';

function ok(label: string): void {
  console.log(`${chalk.green('✓')} ${label}`);
}

function fail(label: string): void {
  console.log(`${chalk.red('✗')} ${label}`);
}

function nodeVersionOk(): boolean {
  const [major] = process.version.slice(1).split('.').map(Number);
  return (major ?? 0) >= 20;
}

function pythonPilAvailable(): boolean {
  try {
    execSync('python3 -c "from PIL import Image"', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function sessionsFound(): boolean {
  if (!existsSync(CLAUDE_SESSIONS_DIR)) return false;
  try {
    const files = readdirSync(CLAUDE_SESSIONS_DIR);
    return files.length > 0;
  } catch {
    return false;
  }
}

export function register(program: Command): void {
  program
    .command('doctor')
    .description('Check environment and diagnose configuration issues')
    .action(async () => {
      console.log(chalk.bold('ADHD-Dev Environment Diagnostics'));
      console.log(chalk.gray('─'.repeat(36)));
      console.log('');

      // Node.js version
      if (nodeVersionOk()) {
        ok(`Node.js >= 20 (${process.version})`);
      } else {
        fail(`Node.js >= 20 required (current: ${process.version})`);
      }

      // ~/.claude/ exists
      if (existsSync(CLAUDE_HOME)) {
        ok('~/.claude/ exists');
      } else {
        fail('~/.claude/ not found — is Claude Code installed?');
      }

      // ~/.adhd-dev/ exists
      if (existsSync(ADHD_DEV_HOME)) {
        ok('~/.adhd-dev/ exists');
      } else {
        fail('~/.adhd-dev/ not found — run `adhd-dev init`');
      }

      // Daemon running
      const daemonRunning = await isDaemonRunning();
      if (daemonRunning) {
        const pidStr = existsSync(PID_FILE) ? readFileSync(PID_FILE, 'utf8').trim() : '?';
        ok(`Daemon running (PID ${pidStr})`);
      } else {
        fail('Daemon not running — run `adhd-dev daemon start`');
      }

      // Hooks installed
      if (areHooksInstalled()) {
        ok('Hooks installed in settings.json');
      } else {
        fail('Hooks not installed — run `adhd-dev install-hooks`');
      }

      // Python + PIL
      if (pythonPilAvailable()) {
        ok('Python + PIL available (sprite regen supported)');
      } else {
        fail('Python + PIL not available (sprite regen disabled — install Pillow)');
      }

      // Sessions found
      if (sessionsFound()) {
        ok('Claude Code sessions found');
      } else {
        fail('No sessions found — start Claude Code to create sessions');
      }

      console.log('');
    });
}
