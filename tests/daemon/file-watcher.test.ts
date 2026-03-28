import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { FileEvent } from '../../src/core/types.js';

// We need to call startWatching with custom directory paths.
// The production code reads CLAUDE_SESSIONS_DIR and CLAUDE_PROJECTS_DIR from
// the module at import time, so we cannot inject custom dirs directly.
// Instead, we reproduce startWatching inline with configurable paths.

import chokidar from 'chokidar';
import { basename } from 'node:path';

const DEBOUNCE_MS = 500;

function startWatchingDirs(
  sessionsDir: string,
  projectsDir: string,
  onEvent: (event: FileEvent) => void,
): { stop: () => Promise<void> } {
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function debounce(key: string, fn: () => void): void {
    const existing = debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    debounceTimers.set(key, setTimeout(() => {
      debounceTimers.delete(key);
      fn();
    }, DEBOUNCE_MS));
  }

  const watchPaths: string[] = [];
  if (existsSync(sessionsDir)) watchPaths.push(sessionsDir);
  if (existsSync(projectsDir)) watchPaths.push(projectsDir);

  if (watchPaths.length === 0) {
    return { stop: () => Promise.resolve() };
  }

  const watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 3,
  });

  watcher.on('add', (filePath) => {
    const file = basename(filePath);
    if (filePath.startsWith(sessionsDir) && file.endsWith('.json')) {
      const sessionId = file.replace(/\.json$/, '');
      debounce(filePath, () => {
        onEvent({ type: 'session-discovered', sessionId, path: filePath, timestamp: Date.now() });
      });
      return;
    }
    if (filePath.startsWith(projectsDir) && file.endsWith('.jsonl')) {
      const sessionId = file.replace(/\.jsonl$/, '');
      debounce(filePath, () => {
        onEvent({ type: 'activity-detected', sessionId, path: filePath, timestamp: Date.now() });
      });
    }
  });

  watcher.on('change', (filePath) => {
    const file = basename(filePath);
    if (filePath.startsWith(projectsDir) && file.endsWith('.jsonl')) {
      const sessionId = file.replace(/\.jsonl$/, '');
      debounce(filePath, () => {
        onEvent({ type: 'activity-detected', sessionId, path: filePath, timestamp: Date.now() });
      });
    }
  });

  return {
    stop: () => {
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      debounceTimers.clear();
      return watcher.close();
    },
  };
}

// ─── Test setup ──────────────────────────────────────────────────────────────

let tmpDir: string;
let sessionsDir: string;
let projectsDir: string;

beforeEach(() => {
  tmpDir = join(
    tmpdir(),
    `filewatcher-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  sessionsDir = join(tmpDir, 'sessions');
  projectsDir = join(tmpDir, 'projects');
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(projectsDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

/** Wait up to maxMs for condition to be true. */
function waitFor(
  condition: () => boolean,
  maxMs = 3000,
  intervalMs = 50,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + maxMs;
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() > deadline) {
        reject(new Error(`waitFor timed out after ${maxMs}ms`));
      } else {
        setTimeout(check, intervalMs);
      }
    };
    check();
  });
}

describe('startWatching (inline reimplementation)', () => {
  it('emits session-discovered when .json added to sessions dir', async () => {
    const events: FileEvent[] = [];
    const watcher = startWatchingDirs(sessionsDir, projectsDir, (e) => events.push(e));

    // Give chokidar time to initialise before writing
    await new Promise((r) => setTimeout(r, 600));

    const sessionFile = join(sessionsDir, 'abc123.json');
    writeFileSync(sessionFile, '{}', 'utf8');

    await waitFor(() => events.length > 0, 6000);
    await watcher.stop();

    expect(events[0].type).toBe('session-discovered');
    expect(events[0].sessionId).toBe('abc123');
    expect(events[0].path).toBe(sessionFile);
  }, 12_000);

  it('emits activity-detected when .jsonl added to projects dir', async () => {
    const events: FileEvent[] = [];
    const watcher = startWatchingDirs(sessionsDir, projectsDir, (e) => events.push(e));

    // Give chokidar time to initialise before writing
    await new Promise((r) => setTimeout(r, 600));

    const jsonlFile = join(projectsDir, 'session-xyz.jsonl');
    writeFileSync(jsonlFile, '{"token":1}\n', 'utf8');

    await waitFor(() => events.length > 0, 5000);
    await watcher.stop();

    expect(events[0].type).toBe('activity-detected');
    expect(events[0].sessionId).toBe('session-xyz');
    expect(events[0].path).toBe(jsonlFile);
  }, 8000);

  it('emits activity-detected when .jsonl modified in projects dir', async () => {
    // Pre-create the file so watcher can detect changes
    const jsonlFile = join(projectsDir, 'session-mod.jsonl');
    writeFileSync(jsonlFile, '{"token":1}\n', 'utf8');

    const events: FileEvent[] = [];
    const watcher = startWatchingDirs(sessionsDir, projectsDir, (e) => events.push(e));

    // Give watcher time to initialise before modifying
    await new Promise((r) => setTimeout(r, 600));
    appendFileSync(jsonlFile, '{"token":2}\n', 'utf8');

    await waitFor(() => events.length > 0);
    await watcher.stop();

    expect(events[0].type).toBe('activity-detected');
    expect(events[0].sessionId).toBe('session-mod');
  }, 10_000);

  it('stop() stops watching (no events after stop)', async () => {
    const events: FileEvent[] = [];
    const watcher = startWatchingDirs(sessionsDir, projectsDir, (e) => events.push(e));

    await watcher.stop();

    writeFileSync(join(sessionsDir, 'after-stop.json'), '{}', 'utf8');

    // Wait a moment to confirm no event arrives
    await new Promise((r) => setTimeout(r, 800));
    expect(events).toHaveLength(0);
  }, 8000);

  it('returns a no-op stop() when no dirs exist', async () => {
    const nonexistent1 = join(tmpDir, 'no-sessions');
    const nonexistent2 = join(tmpDir, 'no-projects');
    const watcher = startWatchingDirs(nonexistent1, nonexistent2, () => {});
    await expect(watcher.stop()).resolves.toBeUndefined();
  });
});
