import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getAdaptiveParams,
  recordDaySignals,
  recalculateParams,
  isBaselinePeriod,
  isBadDayDetected,
  loadBaseline,
} from '../../src/services/adaptive-engine.js';
import { CONSERVATIVE_DEFAULTS, BASELINE_DAYS } from '../../src/core/constants.js';
import type { DaySignals } from '../../src/core/types.js';

let tmpDir: string;
let baselineFile: string;

function makeSignals(overrides: Partial<DaySignals> = {}): DaySignals {
  return {
    date: '2024-01-01',
    productiveAppTimeRatio: 0.7,
    sessionSwitchFrequency: 2,
    timerCompletionRate: 0.5,
    popoverFrequency: 1,
    signalIgnoreRate: 0.2,
    consecutiveSessions: 1,
    maxSessionLengthMin: 25,
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = join(tmpdir(), `adaptive-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  baselineFile = join(tmpDir, 'baseline.json');
});

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('isBaselinePeriod', () => {
  it('returns true when no baseline file exists', () => {
    expect(isBaselinePeriod(baselineFile)).toBe(true);
  });

  it('returns true when fewer than BASELINE_DAYS (7) entries', () => {
    for (let i = 0; i < BASELINE_DAYS - 1; i++) {
      recordDaySignals(makeSignals({ date: `2024-01-0${i + 1}` }), baselineFile);
    }
    expect(isBaselinePeriod(baselineFile)).toBe(true);
  });

  it('returns false when exactly BASELINE_DAYS entries', () => {
    for (let i = 0; i < BASELINE_DAYS; i++) {
      recordDaySignals(makeSignals({ date: `2024-01-${String(i + 1).padStart(2, '0')}` }), baselineFile);
    }
    expect(isBaselinePeriod(baselineFile)).toBe(false);
  });
});

describe('getAdaptiveParams', () => {
  it('returns CONSERVATIVE_DEFAULTS during baseline period', () => {
    const params = getAdaptiveParams(baselineFile);
    expect(params).toEqual(CONSERVATIVE_DEFAULTS);
  });

  it('applies rules after baseline period', () => {
    // Record BASELINE_DAYS days with high ignore rate
    for (let i = 0; i < BASELINE_DAYS; i++) {
      recordDaySignals(makeSignals({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        signalIgnoreRate: 0.8,  // > 0.6
      }), baselineFile);
    }
    const params = getAdaptiveParams(baselineFile);
    expect(params.signalFrequencyMultiplier).toBe(0.5);
  });
});

describe('recalculateParams', () => {
  it('returns defaults when no baseline', () => {
    const params = recalculateParams(baselineFile);
    // No baseline = empty days → returns defaults
    expect(params.signalFrequencyMultiplier).toBe(1.0);
  });

  it('high ignore rate → signalFrequencyMultiplier = 0.5', () => {
    recordDaySignals(makeSignals({ signalIgnoreRate: 0.7 }), baselineFile);
    const params = recalculateParams(baselineFile);
    expect(params.signalFrequencyMultiplier).toBe(0.5);
  });

  it('low productive time for long session → supportiveSilenceMode + intensity 1', () => {
    recordDaySignals(makeSignals({
      productiveAppTimeRatio: 0.2,
      maxSessionLengthMin: 70,
    }), baselineFile);
    const params = recalculateParams(baselineFile);
    expect(params.supportiveSilenceMode).toBe(true);
    expect(params.signalIntensityLevel).toBe(1);
  });

  it('high timer completion rate → signalIntensityLevel = 1', () => {
    recordDaySignals(makeSignals({ timerCompletionRate: 0.9 }), baselineFile);
    const params = recalculateParams(baselineFile);
    expect(params.signalIntensityLevel).toBe(1);
  });

  it('consecutive sessions >= 3 and maxSessionLengthMin > 30 → hyperfocusAlert', () => {
    recordDaySignals(makeSignals({
      consecutiveSessions: 3,
      maxSessionLengthMin: 45,
    }), baselineFile);
    const params = recalculateParams(baselineFile);
    expect(params.hyperfocusAlert).toBe(true);
  });

  it('clamps multiplier to minimum 0.5', () => {
    recordDaySignals(makeSignals({ signalIgnoreRate: 0.99 }), baselineFile);
    const params = recalculateParams(baselineFile);
    expect(params.signalFrequencyMultiplier).toBeGreaterThanOrEqual(0.5);
  });

  it('clamps multiplier to maximum 1.5', () => {
    recordDaySignals(makeSignals({ signalIgnoreRate: 0.0 }), baselineFile);
    const params = recalculateParams(baselineFile);
    expect(params.signalFrequencyMultiplier).toBeLessThanOrEqual(1.5);
  });
});

describe('recordDaySignals', () => {
  it('appends to baseline days array', () => {
    recordDaySignals(makeSignals({ date: '2024-01-01' }), baselineFile);
    recordDaySignals(makeSignals({ date: '2024-01-02' }), baselineFile);
    const baseline = loadBaseline(baselineFile);
    expect(baseline?.days).toHaveLength(2);
    expect(baseline?.days[0].date).toBe('2024-01-01');
    expect(baseline?.days[1].date).toBe('2024-01-02');
  });
});

describe('isBadDayDetected', () => {
  it('returns true for low productive time with long session (direct signals)', () => {
    const signals = makeSignals({ productiveAppTimeRatio: 0.1, maxSessionLengthMin: 90 });
    expect(isBadDayDetected(signals)).toBe(true);
  });

  it('returns false when productive time is above threshold', () => {
    const signals = makeSignals({ productiveAppTimeRatio: 0.5, maxSessionLengthMin: 90 });
    expect(isBadDayDetected(signals)).toBe(false);
  });

  it('returns false when session is short even with low productivity', () => {
    const signals = makeSignals({ productiveAppTimeRatio: 0.1, maxSessionLengthMin: 30 });
    expect(isBadDayDetected(signals)).toBe(false);
  });

  it('reads from baseline file when no direct signals provided', () => {
    recordDaySignals(makeSignals({ productiveAppTimeRatio: 0.1, maxSessionLengthMin: 90 }), baselineFile);
    expect(isBadDayDetected(undefined, baselineFile)).toBe(true);
  });

  it('returns false when baseline is empty', () => {
    expect(isBadDayDetected(undefined, baselineFile)).toBe(false);
  });
});
