import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCardDimensions, renderGridView } from '../../src/tui/grid-view.js';
import type { AgentInfo, DayStats } from '../../src/core/types.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockColumns(cols: number): void {
  Object.defineProperty(process.stdout, 'columns', {
    value: cols,
    configurable: true,
    writable: true,
  });
}

describe('getCardDimensions', () => {
  it('returns 1 column when terminal width is 80', () => {
    mockColumns(80);
    const { columns } = getCardDimensions();
    expect(columns).toBe(1);
  });

  it('returns 2 columns when terminal width is 120', () => {
    mockColumns(120);
    const { columns } = getCardDimensions();
    expect(columns).toBe(2);
  });

  it('returns exactly 2 columns when width is 90 (boundary)', () => {
    mockColumns(90);
    const { columns } = getCardDimensions();
    expect(columns).toBe(2);
  });

  it('returns 1 column when width is 89 (just below boundary)', () => {
    mockColumns(89);
    const { columns } = getCardDimensions();
    expect(columns).toBe(1);
  });

  it('inner width is within [28, 60] for 1-column layout', () => {
    mockColumns(80);
    const { inner } = getCardDimensions();
    expect(inner).toBeGreaterThanOrEqual(28);
    expect(inner).toBeLessThanOrEqual(60);
  });

  it('inner width is within [28, 60] for 2-column layout', () => {
    mockColumns(120);
    const { inner } = getCardDimensions();
    expect(inner).toBeGreaterThanOrEqual(28);
    expect(inner).toBeLessThanOrEqual(60);
  });

  it('outer = inner + 2', () => {
    mockColumns(80);
    const { inner, outer } = getCardDimensions();
    expect(outer).toBe(inner + 2);
  });

  it('clamps inner to minimum 28 for very narrow terminal', () => {
    mockColumns(20);
    const { inner } = getCardDimensions();
    expect(inner).toBe(28);
  });

  it('clamps inner to maximum 60 for very wide 1-column terminal', () => {
    mockColumns(200);
    // 1-column: inner = 200 - 6 = 194, clamped to 60
    mockColumns(200);
    // Override to force 1 column for this test
    Object.defineProperty(process.stdout, 'columns', {
      value: 85,
      configurable: true,
      writable: true,
    });
    const { inner } = getCardDimensions();
    expect(inner).toBeLessThanOrEqual(60);
  });
});

describe('renderGridView', () => {
  const stats: DayStats = {
    focusMinutes: 45,
    completedSessions: 3,
    date: '2026-03-27',
  };

  it('renders without error with no agents', () => {
    mockColumns(80);
    expect(() =>
      renderGridView([], null, stats, null, 0, new Map(), new Set()),
    ).not.toThrow();
  });

  it('returns a non-empty string', () => {
    mockColumns(80);
    const result = renderGridView([], null, stats, null, 0, new Map(), new Set());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes dashboard header', () => {
    mockColumns(80);
    const result = renderGridView([], null, stats, null, 0, new Map(), new Set());
    expect(result).toContain('ADHD-Dev Agent Dashboard');
  });

  it('includes key hints in footer', () => {
    mockColumns(80);
    const result = renderGridView([], null, stats, null, 0, new Map(), new Set());
    expect(result).toContain('[q]uit');
    expect(result).toContain('[t]imer');
  });

  it('shows "No active" message when no agents', () => {
    mockColumns(80);
    const result = renderGridView([], null, stats, null, 0, new Map(), new Set());
    expect(result).toContain('No active');
  });

  it('includes agent project name when agents provided', () => {
    mockColumns(80);
    const agent: AgentInfo = {
      pid: 1234,
      sessionId: 'test-session',
      cwd: '/home/user/project',
      projectName: 'my-awesome-project',
      startedAt: Date.now(),
      state: 'working',
      tokenUsage: 1000,
      rawTokenUsage: 1000,
      level: 2,
      lastExchange: '',
      lastActivityAt: Date.now(),
      jsonlPath: null,
    };
    const result = renderGridView(
      [agent],
      null,
      stats,
      null,
      0,
      new Map(),
      new Set(),
    );
    expect(result).toContain('my-awesome-project');
  });
});
