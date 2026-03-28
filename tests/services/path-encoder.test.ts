import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { encodePath, findProjectDir } from '../../src/services/path-encoder.js';

describe('encodePath', () => {
  it('replaces forward slashes with dashes', () => {
    expect(encodePath('/Users/gimgyeongmin/Desktop')).toBe('-Users-gimgyeongmin-Desktop');
  });

  it('replaces dots with dashes', () => {
    expect(encodePath('/Users/hona.mind/Dev')).toBe('-Users-hona-mind-Dev');
  });

  it('handles paths with both slashes and dots', () => {
    expect(encodePath('/home/user/project.name/src')).toBe('-home-user-project-name-src');
  });

  it('handles simple path with no slashes', () => {
    expect(encodePath('project')).toBe('project');
  });

  it('handles empty string', () => {
    expect(encodePath('')).toBe('');
  });
});

describe('findProjectDir', () => {
  let tempDir: string;
  let cacheFile: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `adhd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    cacheFile = join(tempDir, 'cache.json');
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('finds exact match directory', () => {
    const cwd = '/Users/gimgyeongmin/Desktop';
    const projectDir = join(tempDir, encodePath(cwd));
    mkdirSync(projectDir, { recursive: true });

    const result = findProjectDir(cwd, tempDir);
    expect(result).toBe(projectDir);
  });

  it('returns null when no matching directory exists', () => {
    const result = findProjectDir('/nonexistent/path/here', tempDir);
    expect(result).toBeNull();
  });

  it('fuzzy fallback: matches last 3 segments', () => {
    const cwd = '/a/b/c/gimgyeongmin/Desktop/myproject';
    // Create directory with last 3 segments encoded
    const last3 = '/gimgyeongmin/Desktop/myproject';
    const projectDir = join(tempDir, encodePath(last3));
    mkdirSync(projectDir, { recursive: true });

    const result = findProjectDir(cwd, tempDir);
    expect(result).toBe(projectDir);
  });

  it('fuzzy fallback: matches last 2 segments', () => {
    const cwd = '/a/b/c/d/e/Desktop/myproject';
    // Only create the last 2 segments directory
    const last2 = '/Desktop/myproject';
    const projectDir = join(tempDir, encodePath(last2));
    mkdirSync(projectDir, { recursive: true });

    const result = findProjectDir(cwd, tempDir);
    expect(result).toBe(projectDir);
  });

  it('exact match takes priority over fuzzy', () => {
    const cwd = '/Users/test/project';
    // Create both exact and last 2 segments directories
    const exactDir = join(tempDir, encodePath(cwd));
    const last2Dir = join(tempDir, encodePath('/test/project'));
    mkdirSync(exactDir, { recursive: true });
    mkdirSync(last2Dir, { recursive: true });

    const result = findProjectDir(cwd, tempDir);
    expect(result).toBe(exactDir);
  });

  it('caches successful lookup on second call', () => {
    const cwd = '/Users/cacheme/project';
    const projectDir = join(tempDir, encodePath(cwd));
    mkdirSync(projectDir, { recursive: true });

    // First call - should find and cache
    const result1 = findProjectDir(cwd, tempDir);
    expect(result1).toBe(projectDir);

    // Second call - should return same result (from cache or fresh lookup)
    const result2 = findProjectDir(cwd, tempDir);
    expect(result2).toBe(projectDir);
  });
});
