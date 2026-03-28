import { describe, it, expect } from 'vitest';
import {
  formatTokenCount,
  renderTokenDelta,
  renderLevelBar,
  renderTokenHistogram,
} from '../../src/tui/token-viz.js';
import type { AgentInfo } from '../../src/core/types.js';

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    pid: 1234,
    sessionId: 'test-session',
    cwd: '/home/user/project',
    projectName: 'test-project',
    startedAt: Date.now(),
    state: 'working',
    tokenUsage: 1000,
    rawTokenUsage: 1000,
    level: 2,
    lastExchange: '',
    lastActivityAt: Date.now(),
    jsonlPath: null,
    ...overrides,
  };
}

describe('formatTokenCount', () => {
  it('formats 500 as "500"', () => {
    expect(formatTokenCount(500)).toBe('500');
  });

  it('formats 1200 as "1.2K"', () => {
    expect(formatTokenCount(1200)).toBe('1.2K');
  });

  it('formats 44900 as "44.9K"', () => {
    expect(formatTokenCount(44900)).toBe('44.9K');
  });

  it('formats 1200000 as "1.2M"', () => {
    expect(formatTokenCount(1200000)).toBe('1.2M');
  });

  it('formats 0 as "0"', () => {
    expect(formatTokenCount(0)).toBe('0');
  });

  it('formats 999 as "999"', () => {
    expect(formatTokenCount(999)).toBe('999');
  });

  it('formats 1000000 as "1.0M"', () => {
    expect(formatTokenCount(1000000)).toBe('1.0M');
  });
});

describe('renderTokenDelta', () => {
  it('returns string containing "+1.5K↑" for delta 1500', () => {
    const result = renderTokenDelta(1500);
    expect(result).toContain('+1.5K↑');
  });

  it('returns string containing "-500↓" for delta -500', () => {
    const result = renderTokenDelta(-500);
    expect(result).toContain('-500↓');
  });

  it('returns empty string for delta 50 (below threshold)', () => {
    expect(renderTokenDelta(50)).toBe('');
  });

  it('returns empty string for delta 0', () => {
    expect(renderTokenDelta(0)).toBe('');
  });

  it('returns empty string for delta -50', () => {
    expect(renderTokenDelta(-50)).toBe('');
  });

  it('returns empty string for delta 100 (at boundary)', () => {
    expect(renderTokenDelta(100)).toBe('');
  });

  it('returns positive for delta 101', () => {
    const result = renderTokenDelta(101);
    expect(result).not.toBe('');
    expect(result).toContain('↑');
  });
});

describe('renderLevelBar', () => {
  it('returns a string with level info', () => {
    const agent = makeAgent({ tokenUsage: 44900, level: 3 });
    const result = renderLevelBar(agent, 40);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes level number', () => {
    const agent = makeAgent({ tokenUsage: 44900, level: 3 });
    const result = renderLevelBar(agent, 40);
    expect(result).toContain('Lv3');
  });

  it('includes level name', () => {
    const agent = makeAgent({ tokenUsage: 44900, level: 3 });
    const result = renderLevelBar(agent, 40);
    expect(result).toContain('Adult');
  });
});

describe('renderTokenHistogram', () => {
  it('returns empty array for no agents', () => {
    expect(renderTokenHistogram([], 60)).toEqual([]);
  });

  it('returns one line per agent', () => {
    const agents = [
      makeAgent({ projectName: 'proj-a', tokenUsage: 1000 }),
      makeAgent({ projectName: 'proj-b', tokenUsage: 500 }),
    ];
    const result = renderTokenHistogram(agents, 60);
    expect(result).toHaveLength(2);
  });

  it('each line contains the project name', () => {
    const agents = [
      makeAgent({ projectName: 'my-project', tokenUsage: 1000 }),
    ];
    const result = renderTokenHistogram(agents, 60);
    expect(result[0]).toContain('my-project');
  });
});
