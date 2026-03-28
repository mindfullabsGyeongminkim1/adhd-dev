import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdirSync,
  rmSync,
  existsSync,
  writeFileSync,
  readFileSync,
  utimesSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { purgeOldData, purgeEventLog } from '../../src/services/data-purger.js';

let tmpDir: string;
let statsDir: string;
let eventsLog: string;

beforeEach(() => {
  tmpDir = join(
    tmpdir(),
    `purger-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tmpDir, { recursive: true });
  statsDir = join(tmpDir, 'stats');
  mkdirSync(statsDir, { recursive: true });
  eventsLog = join(tmpDir, 'events.jsonl');
});

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

// Helper: write a stats file and set its mtime to daysAgo days in the past.
function writeOldStatFile(name: string, daysAgo: number): string {
  const filePath = join(statsDir, name);
  writeFileSync(filePath, JSON.stringify({ focusMinutes: 10 }), 'utf8');
  const oldTime = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  utimesSync(filePath, oldTime, oldTime);
  return filePath;
}

function writeNewStatFile(name: string): string {
  const filePath = join(statsDir, name);
  writeFileSync(filePath, JSON.stringify({ focusMinutes: 5 }), 'utf8');
  return filePath;
}

describe('purgeOldData', () => {
  it('returns 0 deleted files when stats dir does not exist', () => {
    const result = purgeOldData(30, join(tmpDir, 'nonexistent'));
    expect(result.deletedFiles).toBe(0);
  });

  it('returns 0 when no files are older than retentionDays', () => {
    writeNewStatFile('2024-01-01.json');
    writeNewStatFile('2024-01-02.json');
    const result = purgeOldData(30, statsDir);
    expect(result.deletedFiles).toBe(0);
  });

  it('deletes files older than retentionDays', () => {
    writeOldStatFile('2023-01-01.json', 60); // 60 days old
    writeOldStatFile('2023-01-02.json', 45); // 45 days old
    writeNewStatFile('2024-01-01.json');      // today

    const result = purgeOldData(30, statsDir);
    expect(result.deletedFiles).toBe(2);
    expect(existsSync(join(statsDir, '2023-01-01.json'))).toBe(false);
    expect(existsSync(join(statsDir, '2023-01-02.json'))).toBe(false);
    expect(existsSync(join(statsDir, '2024-01-01.json'))).toBe(true);
  });

  it('uses default retention of 30 days when not specified', () => {
    writeOldStatFile('old.json', 31);
    writeNewStatFile('new.json');

    const result = purgeOldData(undefined, statsDir);
    expect(result.deletedFiles).toBe(1);
    expect(existsSync(join(statsDir, 'old.json'))).toBe(false);
    expect(existsSync(join(statsDir, 'new.json'))).toBe(true);
  });

  it('ignores non-.json files', () => {
    const txtPath = join(statsDir, 'notes.txt');
    writeFileSync(txtPath, 'data', 'utf8');
    const oldTime = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    utimesSync(txtPath, oldTime, oldTime);

    const result = purgeOldData(30, statsDir);
    expect(result.deletedFiles).toBe(0);
    expect(existsSync(txtPath)).toBe(true);
  });

  it('returns exact count of deleted files', () => {
    writeOldStatFile('a.json', 35);
    writeOldStatFile('b.json', 36);
    writeOldStatFile('c.json', 37);
    const result = purgeOldData(30, statsDir);
    expect(result.deletedFiles).toBe(3);
  });
});

describe('purgeEventLog', () => {
  it('does nothing when events log does not exist', () => {
    // Should not throw
    expect(() => purgeEventLog(1024, join(tmpDir, 'nonexistent.jsonl'))).not.toThrow();
  });

  it('does nothing when file is within size limit', () => {
    const content = '{"event":"test"}\n'.repeat(5);
    writeFileSync(eventsLog, content, 'utf8');
    const originalSize = statSync(eventsLog).size;

    purgeEventLog(originalSize + 1000, eventsLog);
    expect(statSync(eventsLog).size).toBe(originalSize);
  });

  it('truncates file when it exceeds maxSizeBytes', () => {
    // Write 1000 bytes worth of content
    const line = '{"event":"test","data":"x"}\n'; // ~28 bytes
    const content = line.repeat(50); // ~1400 bytes
    writeFileSync(eventsLog, content, 'utf8');

    const before = statSync(eventsLog).size;
    expect(before).toBeGreaterThan(500);

    purgeEventLog(500, eventsLog);
    const after = statSync(eventsLog).size;
    expect(after).toBeLessThan(before);
  });

  it('keeps only the tail of the file after truncation', () => {
    const oldLines = Array.from({ length: 10 }, (_, i) => `{"old":${i}}`).join('\n') + '\n';
    const newLines = Array.from({ length: 5 }, (_, i) => `{"new":${i}}`).join('\n') + '\n';
    writeFileSync(eventsLog, oldLines + newLines, 'utf8');

    // Truncate to keep only ~newLines length
    purgeEventLog(newLines.length + 10, eventsLog);

    const remaining = readFileSync(eventsLog, 'utf8');
    expect(remaining).toContain('"new"');
  });
});
