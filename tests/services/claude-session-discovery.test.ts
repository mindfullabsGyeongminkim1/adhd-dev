import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverSessions, findJsonlForSession } from '../../src/services/claude-session-discovery.js';
import type { RawSession } from '../../src/core/types.js';

let tempDir: string;
let sessionsDir: string;
let projectsDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `discovery-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  sessionsDir = join(tempDir, 'sessions');
  projectsDir = join(tempDir, 'projects');
  mkdirSync(sessionsDir, { recursive: true });
  mkdirSync(projectsDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function writeSession(name: string, data: object): void {
  writeFileSync(join(sessionsDir, `${name}.json`), JSON.stringify(data), 'utf8');
}

describe('discoverSessions', () => {
  it('returns empty array when sessions directory does not exist', () => {
    const result = discoverSessions(join(tempDir, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('discovers valid interactive sessions', () => {
    writeSession('session1', {
      pid: 1001,
      sessionId: 'abc-123',
      cwd: '/home/user/project',
      startedAt: 1710000000000,
      kind: 'interactive',
    });

    const result = discoverSessions(sessionsDir);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('abc-123');
    expect(result[0].pid).toBe(1001);
  });

  it('filters out non-interactive sessions', () => {
    writeSession('interactive', {
      pid: 1001,
      sessionId: 'interactive-session',
      cwd: '/project',
      startedAt: 1710000000000,
      kind: 'interactive',
    });
    writeSession('headless', {
      pid: 1002,
      sessionId: 'headless-session',
      cwd: '/other',
      startedAt: 1710000000000,
      kind: 'headless',
    });

    const result = discoverSessions(sessionsDir);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('interactive-session');
  });

  it('skips malformed JSON files', () => {
    writeFileSync(join(sessionsDir, 'bad.json'), 'not valid json', 'utf8');
    writeSession('good', {
      pid: 1001,
      sessionId: 'good-session',
      cwd: '/project',
      startedAt: 1710000000000,
      kind: 'interactive',
    });

    const result = discoverSessions(sessionsDir);
    expect(result).toHaveLength(1);
    expect(result[0].sessionId).toBe('good-session');
  });

  it('skips sessions with missing required fields', () => {
    writeSession('missing-fields', {
      pid: 'not-a-number',
      sessionId: 'session-x',
      cwd: '/project',
      startedAt: 1710000000000,
      kind: 'interactive',
    });

    const result = discoverSessions(sessionsDir);
    expect(result).toHaveLength(0);
  });

  it('ignores non-.json files', () => {
    writeFileSync(join(sessionsDir, 'readme.txt'), 'text file', 'utf8');
    const result = discoverSessions(sessionsDir);
    expect(result).toHaveLength(0);
  });

  it('discovers multiple sessions', () => {
    for (let i = 0; i < 3; i++) {
      writeSession(`session-${i}`, {
        pid: 1000 + i,
        sessionId: `session-id-${i}`,
        cwd: `/project${i}`,
        startedAt: 1710000000000 + i,
        kind: 'interactive',
      });
    }

    const result = discoverSessions(sessionsDir);
    expect(result).toHaveLength(3);
  });
});

describe('findJsonlForSession', () => {
  it('returns null when project directory is not found', () => {
    const session: RawSession = {
      pid: 1001,
      sessionId: 'test-session',
      cwd: '/completely/nonexistent/path',
      startedAt: 1710000000000,
      kind: 'interactive',
    };

    const result = findJsonlForSession(session, projectsDir);
    expect(result).toBeNull();
  });

  it('returns null when jsonl file does not exist', () => {
    // Create project dir but no jsonl file
    const cwd = '/test/path';
    const encoded = cwd.replace(/[/.]/g, '-');
    mkdirSync(join(projectsDir, encoded), { recursive: true });

    const session: RawSession = {
      pid: 1001,
      sessionId: 'missing-jsonl',
      cwd,
      startedAt: 1710000000000,
      kind: 'interactive',
    };

    const result = findJsonlForSession(session, projectsDir);
    expect(result).toBeNull();
  });

  it('returns jsonl path when project dir and file exist', () => {
    const cwd = '/myapp/src';
    const encoded = cwd.replace(/[/.]/g, '-');
    const projectDir = join(projectsDir, encoded);
    mkdirSync(projectDir, { recursive: true });

    const sessionId = 'session-abc-123';
    const jsonlPath = join(projectDir, `${sessionId}.jsonl`);
    writeFileSync(jsonlPath, '{"type":"assistant"}\n', 'utf8');

    const session: RawSession = {
      pid: 1001,
      sessionId,
      cwd,
      startedAt: 1710000000000,
      kind: 'interactive',
    };

    const result = findJsonlForSession(session, projectsDir);
    expect(result).toBe(jsonlPath);
  });
});
