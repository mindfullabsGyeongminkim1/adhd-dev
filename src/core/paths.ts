import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const HOME = homedir();

// ADHD-Dev home directory
export const ADHD_DEV_HOME = join(HOME, '.adhd-dev');

// Config & state files
export const CONFIG_FILE = join(ADHD_DEV_HOME, 'config.json');
export const TIMER_STATE_FILE = join(ADHD_DEV_HOME, 'timer-state.json');
export const PROMPT_STATE_FILE = join(ADHD_DEV_HOME, 'prompt-state.json');
export const EVENTS_LOG = join(ADHD_DEV_HOME, 'events.jsonl');
export const PATH_CACHE_FILE = join(ADHD_DEV_HOME, 'path-encoding-cache.json');

// Daemon files
export const PID_FILE = join(ADHD_DEV_HOME, 'adhd-dev.pid');
export const SOCKET_PATH = join(ADHD_DEV_HOME, 'adhd-dev.sock');

// Adaptive engine
export const BASELINE_FILE = join(ADHD_DEV_HOME, 'baseline.json');

// Directories
export const LOG_DIR = join(ADHD_DEV_HOME, 'logs');
export const STATS_DIR = join(ADHD_DEV_HOME, 'stats');
export const HOOKS_DIR = join(ADHD_DEV_HOME, 'hooks');

// Log file
export const LOG_FILE = join(LOG_DIR, 'adhd-dev.log');

// Claude Code paths
export const CLAUDE_HOME = join(HOME, '.claude');
export const CLAUDE_SESSIONS_DIR = join(CLAUDE_HOME, 'sessions');
export const CLAUDE_PROJECTS_DIR = join(CLAUDE_HOME, 'projects');
export const CLAUDE_SETTINGS = join(CLAUDE_HOME, 'settings.json');

/**
 * Ensure ~/.adhd-dev/ and all subdirectories exist.
 */
export function ensureHomeDir(): void {
  const dirs = [ADHD_DEV_HOME, LOG_DIR, STATS_DIR, HOOKS_DIR];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Get stats file path for a given date (YYYY-MM-DD).
 */
export function getStatsFilePath(date: string): string {
  return join(STATS_DIR, `${date}.json`);
}
