import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import type { DayStats } from '../core/types.js';
import { ensureHomeDir, getStatsFilePath, STATS_DIR } from '../core/paths.js';

function getTodayDateString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function readStats(filePath: string): DayStats | null {
  if (!existsSync(filePath)) return null;
  try {
    const raw = readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as DayStats;
  } catch {
    return null;
  }
}

function writeStats(stats: DayStats, filePath: string): void {
  ensureHomeDir();
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(stats, null, 2), 'utf8');
  renameSync(tmp, filePath);
}

export function getTodayStats(): DayStats {
  const date = getTodayDateString();
  const filePath = getStatsFilePath(date);
  const existing = readStats(filePath);
  if (existing) return existing;
  const fresh: DayStats = { focusMinutes: 0, completedSessions: 0, date };
  writeStats(fresh, filePath);
  return fresh;
}

export function recordFocusMinutes(minutes: number): void {
  const stats = getTodayStats();
  stats.focusMinutes += minutes;
  writeStats(stats, getStatsFilePath(stats.date));
}

export function recordCompletedSession(): void {
  const stats = getTodayStats();
  stats.completedSessions += 1;
  writeStats(stats, getStatsFilePath(stats.date));
}

export function getStatsForDate(date: string): DayStats | null {
  return readStats(getStatsFilePath(date));
}
