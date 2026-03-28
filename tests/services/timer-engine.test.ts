import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We need to test timer-engine with a custom file path to avoid touching real ~/.adhd-dev
// All exported functions accept an optional filePath override parameter.
import {
  startTimer,
  stopTimer,
  getTimerStatus,
  applyPreset,
  getRemainingMs,
  isTimerComplete,
} from '../../src/services/timer-engine.js';

let tmpDir: string;
let stateFile: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `adhd-timer-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  stateFile = join(tmpDir, 'timer-state.json');
  // Override ensureHomeDir side-effects by using tmpDir as path
});

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('startTimer', () => {
  it('creates a running state file with default 25 minutes', () => {
    const state = startTimer(undefined, stateFile);
    expect(state.running).toBe(true);
    expect(state.durationMs).toBe(25 * 60 * 1000);
    expect(existsSync(stateFile)).toBe(true);
  });

  it('uses the provided minutes', () => {
    const state = startTimer(52, stateFile);
    expect(state.durationMs).toBe(52 * 60 * 1000);
  });

  it('sets startedAt close to now', () => {
    const before = Date.now();
    const state = startTimer(25, stateFile);
    const after = Date.now();
    expect(state.startedAt).toBeGreaterThanOrEqual(before);
    expect(state.startedAt).toBeLessThanOrEqual(after);
  });

  it('restarts if already running (overwrite)', () => {
    startTimer(10, stateFile);
    const state2 = startTimer(20, stateFile);
    expect(state2.durationMs).toBe(20 * 60 * 1000);
    expect(state2.running).toBe(true);
  });
});

describe('stopTimer', () => {
  it('sets running to false', () => {
    startTimer(25, stateFile);
    const state = stopTimer(stateFile);
    expect(state.running).toBe(false);
  });

  it('preserves startedAt from existing state', () => {
    const started = startTimer(25, stateFile);
    const stopped = stopTimer(stateFile);
    expect(stopped.startedAt).toBe(started.startedAt);
  });

  it('works even if no existing state file', () => {
    const state = stopTimer(stateFile);
    expect(state.running).toBe(false);
  });
});

describe('getTimerStatus', () => {
  it('returns null when no file exists', () => {
    expect(getTimerStatus(stateFile)).toBeNull();
  });

  it('returns the written state', () => {
    startTimer(30, stateFile);
    const status = getTimerStatus(stateFile);
    expect(status).not.toBeNull();
    expect(status!.running).toBe(true);
    expect(status!.durationMs).toBe(30 * 60 * 1000);
  });
});

describe('applyPreset', () => {
  it('starts pomodoro preset (25 min)', () => {
    const state = applyPreset('pomodoro', stateFile);
    expect(state.durationMs).toBe(25 * 60 * 1000);
    expect(state.preset).toBe('pomodoro');
    expect(state.running).toBe(true);
  });

  it('starts desktime preset (52 min)', () => {
    const state = applyPreset('desktime', stateFile);
    expect(state.durationMs).toBe(52 * 60 * 1000);
  });

  it('starts ultradian preset (90 min)', () => {
    const state = applyPreset('ultradian', stateFile);
    expect(state.durationMs).toBe(90 * 60 * 1000);
  });

  it('throws on unknown preset', () => {
    expect(() => applyPreset('unknown', stateFile)).toThrow('Unknown preset');
  });
});

describe('getRemainingMs', () => {
  it('returns ~durationMs just after start', () => {
    startTimer(25, stateFile);
    const remaining = getRemainingMs(stateFile);
    // Should be close to 25 min, allow up to 1 second tolerance
    expect(remaining).toBeLessThanOrEqual(25 * 60 * 1000);
    expect(remaining).toBeGreaterThan(25 * 60 * 1000 - 1000);
  });

  it('returns negative value when overdue (mocked Date.now)', () => {
    const realNow = Date.now();
    // Start with a 1-minute timer but mock Date.now to be 2 minutes later
    vi.spyOn(Date, 'now').mockReturnValueOnce(realNow); // for startTimer
    startTimer(1, stateFile);

    vi.spyOn(Date, 'now').mockReturnValue(realNow + 2 * 60 * 1000); // 2 min later
    const remaining = getRemainingMs(stateFile);
    expect(remaining).toBeLessThan(0);
  });

  it('returns 0 when no state file', () => {
    expect(getRemainingMs(stateFile)).toBe(0);
  });
});

describe('isTimerComplete', () => {
  it('returns false when timer still has time', () => {
    startTimer(25, stateFile);
    expect(isTimerComplete(stateFile)).toBe(false);
  });

  it('returns true when overdue (mocked Date.now)', () => {
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValueOnce(realNow);
    startTimer(1, stateFile);

    vi.spyOn(Date, 'now').mockReturnValue(realNow + 2 * 60 * 1000);
    expect(isTimerComplete(stateFile)).toBe(true);
  });

  it('returns false when timer is stopped', () => {
    startTimer(1, stateFile);
    stopTimer(stateFile);
    expect(isTimerComplete(stateFile)).toBe(false);
  });

  it('returns false when no state file', () => {
    expect(isTimerComplete(stateFile)).toBe(false);
  });
});

describe('file persistence round-trip', () => {
  it('reads back exactly what was written', () => {
    const written = startTimer(42, stateFile);
    const read = getTimerStatus(stateFile);
    expect(read).toEqual(written);
  });
});
