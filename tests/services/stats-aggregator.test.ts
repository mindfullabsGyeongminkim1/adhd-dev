import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We'll mock the paths module so stats go into a temp dir
let tmpStatsDir: string;

beforeEach(() => {
  tmpStatsDir = join(tmpdir(), `adhd-stats-test-${Date.now()}`);
  mkdirSync(tmpStatsDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(tmpStatsDir)) {
    rmSync(tmpStatsDir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

// Helper to get a deterministic date string
function isoDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// We test against the real functions but patch paths internals at a lower level
// by mocking the node:fs calls or using the accepted override via getStatsFilePath
// Since stats-aggregator derives paths internally, we'll mock `getStatsFilePath` from paths.js

vi.mock('../../src/core/paths.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/paths.js')>();
  return {
    ...actual,
    getStatsFilePath: (date: string) => join(tmpStatsDir, `${date}.json`),
    ensureHomeDir: () => {},
    STATS_DIR: tmpStatsDir,
  };
});

// Import after mock setup
const { getTodayStats, recordFocusMinutes, recordCompletedSession, getStatsForDate } =
  await import('../../src/services/stats-aggregator.js');

describe('getTodayStats', () => {
  it('creates a file with zeros if it does not exist', () => {
    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(0);
    expect(stats.completedSessions).toBe(0);
    const today = isoDate(new Date());
    expect(stats.date).toBe(today);
  });

  it('returns existing data on second call', () => {
    getTodayStats(); // creates file
    recordFocusMinutes(10);
    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(10);
  });

  it('stores date in YYYY-MM-DD format', () => {
    const stats = getTodayStats();
    expect(stats.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('recordFocusMinutes', () => {
  it('accumulates minutes across multiple calls', () => {
    recordFocusMinutes(10);
    recordFocusMinutes(15);
    recordFocusMinutes(5);
    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(30);
  });

  it('starts from zero if no file exists', () => {
    recordFocusMinutes(25);
    const stats = getTodayStats();
    expect(stats.focusMinutes).toBe(25);
  });
});

describe('recordCompletedSession', () => {
  it('increments completedSessions by 1 each call', () => {
    recordCompletedSession();
    recordCompletedSession();
    const stats = getTodayStats();
    expect(stats.completedSessions).toBe(2);
  });

  it('starts from zero if no file exists', () => {
    recordCompletedSession();
    const stats = getTodayStats();
    expect(stats.completedSessions).toBe(1);
  });
});

describe('getStatsForDate', () => {
  it('returns null for a date with no file', () => {
    const result = getStatsForDate('2020-01-01');
    expect(result).toBeNull();
  });

  it('returns correct data for a written date', () => {
    getTodayStats(); // creates today's file
    recordFocusMinutes(60);
    const today = isoDate(new Date());
    const result = getStatsForDate(today);
    expect(result).not.toBeNull();
    expect(result!.focusMinutes).toBe(60);
    expect(result!.date).toBe(today);
  });
});
