import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CLAUDE_PROJECTS_DIR, PATH_CACHE_FILE } from '../core/paths.js';

export function encodePath(fsPath: string): string {
  return fsPath.replace(/[/.]/g, '-');
}

function loadCache(): Record<string, string> {
  if (!existsSync(PATH_CACHE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(PATH_CACHE_FILE, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, string>): void {
  try {
    writeFileSync(PATH_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch {
    // Silently ignore cache write failures
  }
}

export function findProjectDir(cwd: string, projectsDir?: string): string | null {
  const baseDir = projectsDir ?? CLAUDE_PROJECTS_DIR;

  // Check cache first
  const cache = loadCache();
  if (cache[cwd]) {
    const cached = cache[cwd];
    if (existsSync(cached)) return cached;
    // Cached path no longer exists, remove it
    delete cache[cwd];
    saveCache(cache);
  }

  // Strategy 1: Exact match
  const exact = join(baseDir, encodePath(cwd));
  if (existsSync(exact)) {
    cache[cwd] = exact;
    saveCache(cache);
    return exact;
  }

  // Strategy 2: Fuzzy fallback with last 3 segments
  const segments = cwd.split('/').filter(Boolean);

  if (segments.length >= 3) {
    const last3 = '/' + segments.slice(-3).join('/');
    const encoded3 = join(baseDir, encodePath(last3));
    if (existsSync(encoded3)) {
      cache[cwd] = encoded3;
      saveCache(cache);
      return encoded3;
    }
  }

  // Strategy 3: Fuzzy fallback with last 2 segments
  if (segments.length >= 2) {
    const last2 = '/' + segments.slice(-2).join('/');
    const encoded2 = join(baseDir, encodePath(last2));
    if (existsSync(encoded2)) {
      cache[cwd] = encoded2;
      saveCache(cache);
      return encoded2;
    }
  }

  return null;
}
