import {
  readdirSync,
  statSync,
  unlinkSync,
  existsSync,
  readFileSync,
  writeFileSync,
  truncateSync,
} from 'node:fs';
import { join } from 'node:path';
import { STATS_DIR, EVENTS_LOG } from '../core/paths.js';
import { DEFAULT_RETENTION_DAYS, MAX_LOG_SIZE_BYTES } from '../core/constants.js';

/**
 * Delete stats files older than retentionDays.
 * Stats files are named YYYY-MM-DD.json inside STATS_DIR (or a custom dir).
 */
export function purgeOldData(
  retentionDays?: number,
  statsDir?: string,
): { deletedFiles: number } {
  const dir = statsDir ?? STATS_DIR;
  const days = retentionDays ?? DEFAULT_RETENTION_DAYS;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  if (!existsSync(dir)) {
    return { deletedFiles: 0 };
  }

  let deletedFiles = 0;

  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const filePath = join(dir, entry);
      try {
        const stat = statSync(filePath);
        if (stat.mtimeMs < cutoffMs) {
          unlinkSync(filePath);
          deletedFiles++;
        }
      } catch {
        // Skip files we can't stat or delete
      }
    }
  } catch {
    // Directory unreadable
  }

  return { deletedFiles };
}

/**
 * Truncate events.jsonl to the last N bytes if it exceeds maxSizeBytes.
 * Keeps the tail of the file (most recent events).
 */
export function purgeEventLog(maxSizeBytes?: number, eventsLog?: string): void {
  const logPath = eventsLog ?? EVENTS_LOG;
  const maxSize = maxSizeBytes ?? MAX_LOG_SIZE_BYTES;

  if (!existsSync(logPath)) return;

  try {
    const stat = statSync(logPath);
    if (stat.size <= maxSize) return;

    // Read the tail of the file and rewrite it
    const content = readFileSync(logPath, 'utf8');
    const tail = content.slice(-maxSize);
    // Find the first complete line to avoid partial lines
    const firstNewline = tail.indexOf('\n');
    const trimmed = firstNewline >= 0 ? tail.slice(firstNewline + 1) : tail;
    writeFileSync(logPath, trimmed, 'utf8');
  } catch {
    // Best-effort
  }
}
