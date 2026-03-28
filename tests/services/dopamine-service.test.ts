import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Set up temp dir before module-level mock factory runs
let tmpDir: string;
let tmpPromptStateFile: string;

vi.mock('../../src/core/paths.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/core/paths.js')>();
  return {
    ...orig,
    get PROMPT_STATE_FILE() {
      return tmpPromptStateFile;
    },
    get BASELINE_FILE() {
      return join(tmpDir ?? orig.ADHD_DEV_HOME, 'baseline.json');
    },
    ensureHomeDir: vi.fn(),
  };
});

vi.mock('../../src/services/notification.js', () => ({
  sendBell: vi.fn(),
  sendSystemNotification: vi.fn(),
  notifyTimerComplete: vi.fn(),
}));

vi.mock('../../src/services/signal-emitter.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/services/signal-emitter.js')>();
  return {
    ...orig,
    onActivityDetected: vi.fn().mockReturnValue(null),
    onTimerComplete: vi.fn(),
    onSessionIdle: vi.fn(),
    writePromptState: vi.fn(),
    getQuietMode: vi.fn().mockReturnValue(false),
  };
});

const mockAdaptiveParams = {
  signalFrequencyMultiplier: 1.0,
  signalIntensityLevel: 2 as const,
  quietModeThreshold: 3,
  contextDetailLevel: 'normal' as const,
  supportiveSilenceMode: false,
  hyperfocusAlert: false,
};

vi.mock('../../src/services/adaptive-engine.js', () => ({
  getAdaptiveParams: vi.fn(() => mockAdaptiveParams),
  isBaselinePeriod: vi.fn(() => true),
}));

import { handleEvent, tick, getDopamineState } from '../../src/services/dopamine-service.js';
import { onActivityDetected, onTimerComplete, onSessionIdle, writePromptState, getQuietMode } from '../../src/services/signal-emitter.js';
import { notifyTimerComplete } from '../../src/services/notification.js';
import { getAdaptiveParams } from '../../src/services/adaptive-engine.js';
import type { AgentInfo } from '../../src/core/types.js';

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    pid: 1234,
    sessionId: 'test-session',
    cwd: '/home/user/project',
    projectName: 'project',
    startedAt: Date.now() - 5000,
    state: 'working',
    tokenUsage: 1000,
    rawTokenUsage: 1000,
    level: 1,
    lastExchange: '',
    lastActivityAt: Date.now() - 1000,
    jsonlPath: null,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `dopamine-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  tmpPromptStateFile = join(tmpDir, 'prompt-state.json');
  vi.clearAllMocks();
  // Re-setup mocks cleared by vi.clearAllMocks()
  vi.mocked(onActivityDetected).mockReturnValue(null);
  vi.mocked(getQuietMode).mockReturnValue(false);
  vi.mocked(getAdaptiveParams).mockReturnValue(mockAdaptiveParams);
});

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('handleEvent', () => {
  it('routes activity-detected to onActivityDetected', () => {
    handleEvent({ type: 'activity-detected', timestamp: Date.now() });
    expect(onActivityDetected).toHaveBeenCalledOnce();
  });

  it('routes session-stop to onSessionIdle when projectName is provided', () => {
    handleEvent({ type: 'session-stop', projectName: 'my-app', timestamp: Date.now() });
    expect(onSessionIdle).toHaveBeenCalledWith('my-app');
  });

  it('does not call onSessionIdle when projectName is missing', () => {
    handleEvent({ type: 'session-stop', timestamp: Date.now() });
    expect(onSessionIdle).not.toHaveBeenCalled();
  });

  it('routes timer-complete to onTimerComplete and notifyTimerComplete', () => {
    handleEvent({ type: 'timer-complete', timestamp: Date.now() });
    expect(onTimerComplete).toHaveBeenCalledOnce();
    expect(notifyTimerComplete).toHaveBeenCalledOnce();
  });

  it('routes level-up to writePromptState with flash', () => {
    handleEvent({ type: 'level-up', sessionId: 'abc', timestamp: Date.now() });
    expect(writePromptState).toHaveBeenCalledWith({ pulse: 'flash' });
  });

  it('handles session-start without errors', () => {
    expect(() => handleEvent({ type: 'session-start', timestamp: Date.now() })).not.toThrow();
  });

  it('handles timer-start without errors', () => {
    expect(() => handleEvent({ type: 'timer-start', timestamp: Date.now() })).not.toThrow();
  });
});

describe('tick', () => {
  it('calls writePromptState with timeOfDay and warmth', () => {
    tick([makeAgent()]);
    expect(writePromptState).toHaveBeenCalled();
    const callArg = vi.mocked(writePromptState).mock.calls[0]?.[0];
    expect(callArg).toHaveProperty('timeOfDay');
    expect(callArg).toHaveProperty('warmth');
  });

  it('sets warmth to cool when no working agents', () => {
    tick([makeAgent({ state: 'idle' })]);
    const callArg = vi.mocked(writePromptState).mock.calls[0]?.[0];
    expect(callArg?.['warmth']).toBe('cool');
  });

  it('sets warmth to warm with one working agent', () => {
    tick([makeAgent({ state: 'working' })]);
    const callArg = vi.mocked(writePromptState).mock.calls[0]?.[0];
    expect(callArg?.['warmth']).toBe('warm');
  });

  it('sets warmth to hot with multiple working agents', () => {
    tick([makeAgent({ state: 'working' }), makeAgent({ state: 'working', sessionId: 'b' })]);
    const callArg = vi.mocked(writePromptState).mock.calls[0]?.[0];
    expect(callArg?.['warmth']).toBe('hot');
  });

  it('computes timeOfDay as AM in morning hours', () => {
    vi.setSystemTime(new Date('2024-01-01T09:00:00'));
    tick([]);
    const callArg = vi.mocked(writePromptState).mock.calls[0]?.[0];
    expect(callArg?.['timeOfDay']).toBe('AM');
    vi.useRealTimers();
  });

  it('computes timeOfDay as PM in afternoon hours', () => {
    vi.setSystemTime(new Date('2024-01-01T14:00:00'));
    tick([]);
    const callArg = vi.mocked(writePromptState).mock.calls[0]?.[0];
    expect(callArg?.['timeOfDay']).toBe('PM');
    vi.useRealTimers();
  });

  it('computes timeOfDay as EVE in evening hours', () => {
    vi.setSystemTime(new Date('2024-01-01T21:00:00'));
    tick([]);
    const callArg = vi.mocked(writePromptState).mock.calls[0]?.[0];
    expect(callArg?.['timeOfDay']).toBe('EVE');
    vi.useRealTimers();
  });
});

describe('getDopamineState', () => {
  it('returns timeOfDay, warmth, quietMode, and adaptiveParams', () => {
    const state = getDopamineState();
    expect(state).toHaveProperty('timeOfDay');
    expect(state).toHaveProperty('warmth');
    expect(state).toHaveProperty('quietMode');
    expect(state).toHaveProperty('adaptiveParams');
  });

  it('ETHICAL: does not include streak data', () => {
    const state = getDopamineState();
    expect(state).not.toHaveProperty('streak');
    expect(state).not.toHaveProperty('streakDays');
    expect(state).not.toHaveProperty('consecutiveDays');
  });

  it('ETHICAL: does not include comparison data', () => {
    const state = getDopamineState();
    expect(state).not.toHaveProperty('yesterdayComparison');
    expect(state).not.toHaveProperty('vsYesterday');
  });

  it('ETHICAL: does not include wasted time data', () => {
    const state = getDopamineState();
    expect(state).not.toHaveProperty('wastedMinutes');
    expect(state).not.toHaveProperty('inactiveTime');
    expect(state).not.toHaveProperty('minutesAway');
  });

  it('adaptiveParams has expected shape', () => {
    const state = getDopamineState();
    expect(state.adaptiveParams).toHaveProperty('signalFrequencyMultiplier');
    expect(state.adaptiveParams).toHaveProperty('signalIntensityLevel');
    expect(state.adaptiveParams).toHaveProperty('supportiveSilenceMode');
    expect(state.adaptiveParams).toHaveProperty('hyperfocusAlert');
  });
});
