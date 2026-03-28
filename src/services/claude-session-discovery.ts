import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { RawSession } from '../core/types.js';
import { CLAUDE_SESSIONS_DIR, CLAUDE_PROJECTS_DIR } from '../core/paths.js';
import { findProjectDir } from './path-encoder.js';

/**
 * Discover sessions from ~/.claude/sessions/*.json (active PID files).
 */
export function discoverSessions(sessionsDir?: string): RawSession[] {
  const dir = sessionsDir ?? CLAUDE_SESSIONS_DIR;

  if (!existsSync(dir)) return [];

  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }

  const sessions: RawSession[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const filePath = join(dir, file);
    try {
      const raw = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as RawSession;

      if (parsed.kind !== 'interactive') continue;

      if (
        typeof parsed.pid !== 'number' ||
        typeof parsed.sessionId !== 'string' ||
        typeof parsed.cwd !== 'string' ||
        typeof parsed.startedAt !== 'number'
      ) {
        continue;
      }

      sessions.push(parsed);
    } catch {
      // Skip malformed session files
    }
  }

  return sessions;
}

/**
 * Discover ALL sessions by scanning ~/.claude/projects/ directories for jsonl files.
 * This finds past sessions that no longer have active PID files.
 */
export function discoverAllSessions(projectsDir?: string): RawSession[] {
  const dir = projectsDir ?? CLAUDE_PROJECTS_DIR;
  if (!existsSync(dir)) return [];

  const knownSessionIds = new Set<string>();
  const sessions: RawSession[] = [];

  // First add active sessions from PID files
  for (const s of discoverSessions()) {
    knownSessionIds.add(s.sessionId);
    sessions.push(s);
  }

  // Then scan project directories for jsonl files
  let projectDirs: string[];
  try {
    projectDirs = readdirSync(dir);
  } catch {
    return sessions;
  }

  for (const projName of projectDirs) {
    const projPath = join(dir, projName);
    try {
      if (!statSync(projPath).isDirectory()) continue;
    } catch { continue; }

    // Decode cwd from directory name: -Users-foo-bar → /Users/foo/bar
    const cwd = projName.replace(/^-/, '/').replace(/-/g, '/');

    let files: string[];
    try {
      files = readdirSync(projPath);
    } catch { continue; }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue;
      const sessionId = file.replace('.jsonl', '');

      // Skip if already known from active PID sessions
      if (knownSessionIds.has(sessionId)) continue;
      // Skip subagent/meta files
      if (sessionId.includes('.meta') || sessionId.includes('agent-')) continue;

      knownSessionIds.add(sessionId);

      const jsonlPath = join(projPath, file);
      let startedAt = 0;
      try {
        const st = statSync(jsonlPath);
        startedAt = st.birthtimeMs || st.mtimeMs;
      } catch {}

      // Derive project name from last cwd segment
      const cwdParts = cwd.split('/').filter(Boolean);
      const projectName = cwdParts[cwdParts.length - 1] ?? projName;

      sessions.push({
        pid: 0,           // no active PID
        sessionId,
        cwd,
        startedAt,
        kind: 'interactive',
      });
    }
  }

  return sessions;
}

export function findJsonlForSession(
  session: RawSession,
  projectsDir?: string
): string | null {
  const dir = projectsDir ?? CLAUDE_PROJECTS_DIR;

  // Try direct lookup by cwd
  const projectDir = findProjectDir(session.cwd, dir);
  if (projectDir) {
    const jsonlPath = join(projectDir, `${session.sessionId}.jsonl`);
    if (existsSync(jsonlPath)) return jsonlPath;
  }

  // Fallback: scan all project dirs for this sessionId
  if (existsSync(dir)) {
    try {
      for (const projName of readdirSync(dir)) {
        const jsonlPath = join(dir, projName, `${session.sessionId}.jsonl`);
        if (existsSync(jsonlPath)) return jsonlPath;
      }
    } catch {}
  }

  return null;
}
