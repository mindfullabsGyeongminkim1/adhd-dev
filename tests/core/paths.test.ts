import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';

// Import path constants and utilities from the production module.
// Note: ADHD_DEV_HOME, STATS_DIR, etc. are computed at import time relative
// to the real homedir(), so we verify their shapes here.
import {
  ADHD_DEV_HOME,
  ensureHomeDir,
  getStatsFilePath,
  LOG_DIR,
  STATS_DIR,
  HOOKS_DIR,
} from '../../src/core/paths.js';

describe('ADHD_DEV_HOME', () => {
  it('ends with .adhd-dev', () => {
    expect(ADHD_DEV_HOME.endsWith('.adhd-dev')).toBe(true);
  });

  it('is under the user home directory', () => {
    expect(ADHD_DEV_HOME.startsWith(homedir())).toBe(true);
  });
});

describe('ensureHomeDir', () => {
  it('creates ~/.adhd-dev and subdirectories if they do not exist', () => {
    // ensureHomeDir touches the real home dir, which is acceptable.
    // We verify it doesn't throw and that the directory exists afterwards.
    expect(() => ensureHomeDir()).not.toThrow();
    expect(existsSync(ADHD_DEV_HOME)).toBe(true);
    expect(existsSync(LOG_DIR)).toBe(true);
    expect(existsSync(STATS_DIR)).toBe(true);
    expect(existsSync(HOOKS_DIR)).toBe(true);
  });

  it('is idempotent — calling twice does not throw', () => {
    ensureHomeDir();
    expect(() => ensureHomeDir()).not.toThrow();
  });
});

describe('getStatsFilePath', () => {
  it('returns correct path for a given date', () => {
    const p = getStatsFilePath('2024-01-15');
    expect(p).toBe(join(ADHD_DEV_HOME, 'stats', '2024-01-15.json'));
  });

  it('uses the STATS_DIR base directory', () => {
    const p = getStatsFilePath('2024-06-01');
    expect(p.startsWith(STATS_DIR)).toBe(true);
  });

  it('ends with <date>.json', () => {
    const date = '2025-12-31';
    const p = getStatsFilePath(date);
    expect(p.endsWith(`${date}.json`)).toBe(true);
  });

  it('works for various date formats', () => {
    const dates = ['2024-01-01', '2024-12-31', '2025-03-27'];
    for (const date of dates) {
      const p = getStatsFilePath(date);
      expect(p).toContain(date);
      expect(p.endsWith('.json')).toBe(true);
    }
  });
});
