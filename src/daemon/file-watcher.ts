import chokidar from 'chokidar';
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { CLAUDE_SESSIONS_DIR, CLAUDE_PROJECTS_DIR } from '../core/paths.js';
import { logInfo, logWarn } from '../core/logger.js';
import type { FileEvent } from '../core/types.js';

const DEBOUNCE_MS = 500;

export function startWatching(onEvent: (event: FileEvent) => void): { stop: () => Promise<void> } {
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

  if (existsSync(CLAUDE_SESSIONS_DIR)) {
    watchPaths.push(CLAUDE_SESSIONS_DIR);
  } else {
    logWarn('Claude sessions directory does not exist, skipping watch', { path: CLAUDE_SESSIONS_DIR });
  }

  if (existsSync(CLAUDE_PROJECTS_DIR)) {
    watchPaths.push(CLAUDE_PROJECTS_DIR);
  } else {
    logWarn('Claude projects directory does not exist, skipping watch', { path: CLAUDE_PROJECTS_DIR });
  }

  if (watchPaths.length === 0) {
    logWarn('No directories to watch; file watcher is inactive');
    return {
      stop: () => Promise.resolve(),
    };
  }

  const watcher = chokidar.watch(watchPaths, {
    persistent: true,
    ignoreInitial: true,
    depth: 3,
  });

  watcher.on('add', (filePath) => {
    const file = basename(filePath);

    // Session JSON added under sessions dir
    if (filePath.startsWith(CLAUDE_SESSIONS_DIR) && file.endsWith('.json')) {
      const sessionId = file.replace(/\.json$/, '');
      debounce(filePath, () => {
        onEvent({
          type: 'session-discovered',
          sessionId,
          path: filePath,
          timestamp: Date.now(),
        });
      });
      return;
    }

    // JSONL added under projects dir
    if (filePath.startsWith(CLAUDE_PROJECTS_DIR) && file.endsWith('.jsonl')) {
      const sessionId = file.replace(/\.jsonl$/, '');
      debounce(filePath, () => {
        onEvent({
          type: 'activity-detected',
          sessionId,
          path: filePath,
          timestamp: Date.now(),
        });
      });
    }
  });

  watcher.on('unlink', (filePath) => {
    const file = basename(filePath);

    // Session JSON removed
    if (filePath.startsWith(CLAUDE_SESSIONS_DIR) && file.endsWith('.json')) {
      const sessionId = file.replace(/\.json$/, '');
      debounce(filePath, () => {
        onEvent({
          type: 'session-removed',
          sessionId,
          path: filePath,
          timestamp: Date.now(),
        });
      });
    }
  });

  watcher.on('change', (filePath) => {
    const file = basename(filePath);

    // JSONL changed under projects dir
    if (filePath.startsWith(CLAUDE_PROJECTS_DIR) && file.endsWith('.jsonl')) {
      const sessionId = file.replace(/\.jsonl$/, '');
      debounce(filePath, () => {
        onEvent({
          type: 'activity-detected',
          sessionId,
          path: filePath,
          timestamp: Date.now(),
        });
      });
    }
  });

  watcher.on('error', (err) => {
    logWarn('File watcher error', { message: (err as Error).message });
  });

  logInfo('File watcher started', { paths: watchPaths });

  return {
    stop: () => {
      // Clear any pending debounce timers
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      return watcher.close();
    },
  };
}
