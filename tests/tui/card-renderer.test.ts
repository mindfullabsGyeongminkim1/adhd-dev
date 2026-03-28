import { describe, it, expect } from 'vitest';
import {
  describeActivity,
  summarizeExchange,
  renderCard,
} from '../../src/tui/card-renderer.js';
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

describe('describeActivity', () => {
  it('returns "휴식 중..." for sleeping agent', () => {
    const agent = makeAgent({ state: 'sleeping' });
    expect(describeActivity(agent, 40)).toBe('휴식 중...');
  });

  it('returns "대기 중..." for idle agent', () => {
    const agent = makeAgent({ state: 'idle' });
    expect(describeActivity(agent, 40)).toBe('대기 중...');
  });

  it('returns "작업 완료!" for working agent with no exchange', () => {
    const agent = makeAgent({ state: 'working', lastExchange: '' });
    expect(describeActivity(agent, 40)).toBe('작업 완료!');
  });

  it('returns summarized exchange for working agent with exchange', () => {
    const agent = makeAgent({
      state: 'working',
      lastExchange: 'Writing test cases for the new feature',
    });
    const result = describeActivity(agent, 40);
    expect(result).toContain('Writing test cases');
  });
});

describe('summarizeExchange', () => {
  it('strips ** markdown', () => {
    const result = summarizeExchange('**Bold text** here', 50);
    expect(result).not.toContain('**');
  });

  it('strips backtick markdown', () => {
    const result = summarizeExchange('Use `code` here', 50);
    expect(result).not.toContain('`');
  });

  it('strips pipe characters', () => {
    const result = summarizeExchange('| table | row |', 50);
    // Table rows are skipped entirely, so result may be empty
    // or from another line
    expect(result).not.toContain('|');
  });

  it('strips heading markers', () => {
    const result = summarizeExchange('## Heading\nSome text', 50);
    // ## heading line is skipped, so result is from 'Some text'
    expect(result).toBe('Some text');
  });

  it('skips empty lines', () => {
    const result = summarizeExchange('\n\nActual content', 50);
    expect(result).toBe('Actual content');
  });

  it('skips code fence lines', () => {
    const result = summarizeExchange('```javascript\ncode here\n```\nPlain text', 50);
    expect(result).not.toContain('```');
    // code here doesn't start with ``` so it's the first "meaningful" line
    expect(result).toBe('code here');
  });

  it('truncates to maxLen', () => {
    const longText = 'A'.repeat(100);
    const result = summarizeExchange(longText, 10);
    expect(result.length).toBeLessThanOrEqual(12); // 10 + ellipsis width
  });

  it('returns empty string for empty input', () => {
    expect(summarizeExchange('', 40)).toBe('');
  });
});

describe('renderCard', () => {
  it('returns an array of strings', () => {
    const agent = makeAgent();
    const result = renderCard(agent, 0, 0, 30, false);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const line of result) {
      expect(typeof line).toBe('string');
    }
  });

  it('first line starts with top box border', () => {
    const agent = makeAgent();
    const result = renderCard(agent, 0, 0, 30, false);
    // First line should contain ┌ (top-left corner)
    expect(result[0]).toContain('┌');
  });

  it('last line contains bottom box border', () => {
    const agent = makeAgent();
    const result = renderCard(agent, 0, 0, 30, false);
    const lastLine = result[result.length - 1]!;
    expect(lastLine).toContain('└');
  });

  it('renders without error for all agent states', () => {
    for (const state of ['working', 'idle', 'sleeping'] as const) {
      const agent = makeAgent({ state });
      expect(() => renderCard(agent, 0, 0, 30, false)).not.toThrow();
    }
  });

  it('renders without error with flash=true', () => {
    const agent = makeAgent();
    expect(() => renderCard(agent, 0, 0, 30, true)).not.toThrow();
  });
});
