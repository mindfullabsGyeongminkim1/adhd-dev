import { join } from 'node:path';
import type { AgentInfo, AgentState } from '../core/types.js';
import {
  LEVEL_THRESHOLDS,
  DECAY_RATE_IDLE,
  DECAY_RATE_SLEEPING,
  WORKING_THRESHOLD_MS,
  IDLE_THRESHOLD_MS,
} from '../core/constants.js';
import { discoverAllSessions, findJsonlForSession } from './claude-session-discovery.js';
import { parseJsonlFile } from './claude-session-parser.js';

export function computeLevel(tokens: number): number {
  // Binary search on LEVEL_THRESHOLDS
  // LEVEL_THRESHOLDS = [0, 1000, 10000, 50000, 200000]
  // Level 1: 0-999, Level 2: 1000-9999, ..., Level 5: 200000+
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (tokens >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

export function determineState(lastActivityAt: number, now?: number): AgentState {
  const currentTime = now ?? Date.now();
  const elapsed = currentTime - lastActivityAt;

  if (elapsed < WORKING_THRESHOLD_MS) return 'working';
  if (elapsed < IDLE_THRESHOLD_MS) return 'idle';
  return 'sleeping';
}

export function applyTokenDecay(
  tokens: number,
  state: AgentState,
  inactiveMs: number
): number {
  if (state === 'working' || state === 'complete' as AgentState) {
    return tokens;
  }

  const rate = state === 'idle' ? DECAY_RATE_IDLE : DECAY_RATE_SLEEPING;
  const hours = inactiveMs / (1000 * 60 * 60);
  const decayed = tokens * Math.pow(1 - rate, hours);

  return Math.max(0, decayed);
}

export function discoverAgents(projectsDir?: string): AgentInfo[] {
  const sessions = discoverAllSessions();
  const now = Date.now();
  const agents: AgentInfo[] = [];

  for (const session of sessions) {
    const jsonlPath = findJsonlForSession(session, projectsDir);
    const parsed = jsonlPath
      ? parseJsonlFile(jsonlPath)
      : { totalTokens: 0, lastExchange: '', lastAssistantTimestamp: 0, lineCount: 0 };

    const lastActivityAt = parsed.lastAssistantTimestamp > 0
      ? parsed.lastAssistantTimestamp
      : session.startedAt;

    const state = determineState(lastActivityAt, now);
    const inactiveMs = now - lastActivityAt;
    const rawTokenUsage = parsed.totalTokens;
    const tokenUsage = applyTokenDecay(rawTokenUsage, state, inactiveMs);
    const level = computeLevel(tokenUsage);

    // Derive project name from last segment of cwd
    const cwdParts = session.cwd.split('/').filter(Boolean);
    const projectName = cwdParts[cwdParts.length - 1] ?? session.cwd;

    agents.push({
      pid: session.pid,
      sessionId: session.sessionId,
      cwd: session.cwd,
      projectName,
      startedAt: session.startedAt,
      state,
      tokenUsage,
      rawTokenUsage,
      level,
      lastExchange: parsed.lastExchange,
      lastActivityAt,
      jsonlPath,
    });
  }

  return agents;
}
