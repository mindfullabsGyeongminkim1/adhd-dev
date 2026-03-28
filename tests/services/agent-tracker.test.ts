import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  computeLevel,
  applyTokenDecay,
  determineState,
  discoverAgents,
} from '../../src/services/agent-tracker.js';
import type { AgentState } from '../../src/core/types.js';

describe('computeLevel', () => {
  it('returns level 1 for 0 tokens', () => {
    expect(computeLevel(0)).toBe(1);
  });

  it('returns level 1 for 999 tokens', () => {
    expect(computeLevel(999)).toBe(1);
  });

  it('returns level 2 for exactly 1000 tokens', () => {
    expect(computeLevel(1000)).toBe(2);
  });

  it('returns level 2 for 9999 tokens', () => {
    expect(computeLevel(9999)).toBe(2);
  });

  it('returns level 3 for exactly 10000 tokens', () => {
    expect(computeLevel(10000)).toBe(3);
  });

  it('returns level 4 for exactly 50000 tokens', () => {
    expect(computeLevel(50000)).toBe(4);
  });

  it('returns level 5 for exactly 200000 tokens', () => {
    expect(computeLevel(200000)).toBe(5);
  });

  it('returns level 5 for very large token counts', () => {
    expect(computeLevel(1_000_000)).toBe(5);
  });
});

describe('determineState', () => {
  const NOW = 1710000000000;

  it('returns working for activity within 2 minutes', () => {
    const lastActivity = NOW - 1 * 60 * 1000; // 1 minute ago
    expect(determineState(lastActivity, NOW)).toBe('working');
  });

  it('returns working for activity exactly at 0ms', () => {
    expect(determineState(NOW, NOW)).toBe('working');
  });

  it('returns idle for activity between 2 and 15 minutes ago', () => {
    const lastActivity = NOW - 5 * 60 * 1000; // 5 minutes ago
    expect(determineState(lastActivity, NOW)).toBe('idle');
  });

  it('returns idle for activity just under 15 minutes ago', () => {
    const lastActivity = NOW - 14 * 60 * 1000 - 59 * 1000; // ~15 min ago
    expect(determineState(lastActivity, NOW)).toBe('idle');
  });

  it('returns sleeping for activity at exactly 15 minutes ago', () => {
    const lastActivity = NOW - 15 * 60 * 1000; // exactly 15 minutes ago
    expect(determineState(lastActivity, NOW)).toBe('sleeping');
  });

  it('returns sleeping for activity more than 15 minutes ago', () => {
    const lastActivity = NOW - 60 * 60 * 1000; // 1 hour ago
    expect(determineState(lastActivity, NOW)).toBe('sleeping');
  });

  it('returns working for activity exactly at 2 minutes ago - 1ms', () => {
    const lastActivity = NOW - (2 * 60 * 1000 - 1);
    expect(determineState(lastActivity, NOW)).toBe('working');
  });

  it('returns idle for activity at exactly 2 minutes ago', () => {
    const lastActivity = NOW - 2 * 60 * 1000;
    expect(determineState(lastActivity, NOW)).toBe('idle');
  });
});

describe('applyTokenDecay', () => {
  it('does not decay tokens in working state', () => {
    expect(applyTokenDecay(10000, 'working', 60 * 60 * 1000)).toBe(10000);
  });

  it('idle: approximately halves tokens in 35 hours (rate=0.02/h)', () => {
    // half-life for idle: ln(2)/0.02 ≈ 34.66 hours
    // After 35h: 10000 * (0.98)^35 ≈ 4931
    const inactiveMs = 35 * 60 * 60 * 1000;
    const result = applyTokenDecay(10000, 'idle', inactiveMs);
    // Should be roughly half (within 20% of 5000)
    expect(result).toBeGreaterThan(4000);
    expect(result).toBeLessThan(6000);
  });

  it('sleeping: approximately halves tokens in 14 hours (rate=0.05/h)', () => {
    // half-life for sleeping: ln(2)/0.05 ≈ 13.86 hours
    // After 14h: 10000 * (0.95)^14 ≈ 4877
    const inactiveMs = 14 * 60 * 60 * 1000;
    const result = applyTokenDecay(10000, 'sleeping', inactiveMs);
    // Should be roughly half (within 20% of 5000)
    expect(result).toBeGreaterThan(4000);
    expect(result).toBeLessThan(6000);
  });

  it('never goes below 0', () => {
    // Extremely long inactivity
    const inactiveMs = 999999 * 60 * 60 * 1000;
    const result = applyTokenDecay(10000, 'sleeping', inactiveMs);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 tokens as 0 regardless of state or time', () => {
    expect(applyTokenDecay(0, 'idle', 100 * 60 * 60 * 1000)).toBe(0);
    expect(applyTokenDecay(0, 'sleeping', 100 * 60 * 60 * 1000)).toBe(0);
  });

  it('does not decay for 0 inactive time', () => {
    expect(applyTokenDecay(10000, 'idle', 0)).toBe(10000);
    expect(applyTokenDecay(10000, 'sleeping', 0)).toBe(10000);
  });
});

describe('discoverAgents (mocked)', () => {
  beforeEach(() => {
    vi.mock('../../src/services/claude-session-discovery.js', () => ({
      discoverSessions: vi.fn(),
      findJsonlForSession: vi.fn(),
    }));
    vi.mock('../../src/services/claude-session-parser.js', () => ({
      parseJsonlFile: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it('returns empty array when no sessions discovered', async () => {
    const { discoverSessions } = await import('../../src/services/claude-session-discovery.js');
    vi.mocked(discoverSessions).mockReturnValue([]);

    const agents = discoverAgents();
    expect(agents).toEqual([]);
  });

  it('builds AgentInfo from session and parsed JSONL', async () => {
    const { discoverSessions, findJsonlForSession } = await import('../../src/services/claude-session-discovery.js');
    const { parseJsonlFile } = await import('../../src/services/claude-session-parser.js');

    const now = Date.now();
    const recentTimestamp = Math.floor((now - 60 * 1000) / 1000); // 1 min ago (in seconds)

    vi.mocked(discoverSessions).mockReturnValue([
      {
        pid: 1234,
        sessionId: 'test-session',
        cwd: '/home/user/myproject',
        startedAt: now - 3600000,
        kind: 'interactive',
      },
    ]);
    vi.mocked(findJsonlForSession).mockReturnValue('/mock/path/test-session.jsonl');
    vi.mocked(parseJsonlFile).mockReturnValue({
      totalTokens: 5000,
      lastExchange: 'Working on feature X',
      lastAssistantTimestamp: recentTimestamp,
      lineCount: 10,
    });

    const agents = discoverAgents();
    expect(agents).toHaveLength(1);
    const agent = agents[0];
    expect(agent.pid).toBe(1234);
    expect(agent.projectName).toBe('myproject');
    expect(agent.state).toBe('working');
    expect(agent.rawTokenUsage).toBe(5000);
    expect(agent.lastExchange).toBe('Working on feature X');
    expect(agent.jsonlPath).toBe('/mock/path/test-session.jsonl');
    expect(agent.level).toBeGreaterThanOrEqual(1);
  });

  it('handles session with no jsonl file', async () => {
    const { discoverSessions, findJsonlForSession } = await import('../../src/services/claude-session-discovery.js');

    vi.mocked(discoverSessions).mockReturnValue([
      {
        pid: 5678,
        sessionId: 'no-jsonl-session',
        cwd: '/home/user/another-project',
        startedAt: Date.now() - 3600000,
        kind: 'interactive',
      },
    ]);
    vi.mocked(findJsonlForSession).mockReturnValue(null);

    const agents = discoverAgents();
    expect(agents).toHaveLength(1);
    const agent = agents[0];
    expect(agent.jsonlPath).toBeNull();
    expect(agent.totalTokens ?? agent.rawTokenUsage).toBe(0);
    expect(agent.lastExchange).toBe('');
  });
});
