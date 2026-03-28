import { describe, it, expect } from 'vitest';
import {
  LEVEL_THRESHOLDS,
  FIBONACCI,
  TIMER_PRESETS,
  LEVEL_NAMES,
  BACKUP_ROTATION_COUNT,
  DEFAULT_RETENTION_DAYS,
  IPC_TIMEOUT_MS,
} from '../../src/core/constants.js';
import type { TimerPreset } from '../../src/core/types.js';

describe('LEVEL_THRESHOLDS', () => {
  it('has exactly 5 entries', () => {
    expect(LEVEL_THRESHOLDS).toHaveLength(5);
  });

  it('starts at 0', () => {
    expect(LEVEL_THRESHOLDS[0]).toBe(0);
  });

  it('is in ascending order', () => {
    for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
      expect(LEVEL_THRESHOLDS[i]).toBeGreaterThan(LEVEL_THRESHOLDS[i - 1]);
    }
  });

  it('matches LEVEL_NAMES in count', () => {
    expect(LEVEL_THRESHOLDS.length).toBe(LEVEL_NAMES.length);
  });
});

describe('FIBONACCI', () => {
  it('starts with correct Fibonacci values', () => {
    // First values of Fibonacci starting at 3: 3, 5, 8, 13, 21, 34, 55, 89
    expect(FIBONACCI[0]).toBe(3);
    expect(FIBONACCI[1]).toBe(5);
    expect(FIBONACCI[2]).toBe(8);
    expect(FIBONACCI[3]).toBe(13);
    expect(FIBONACCI[4]).toBe(21);
    expect(FIBONACCI[5]).toBe(34);
    expect(FIBONACCI[6]).toBe(55);
    expect(FIBONACCI[7]).toBe(89);
  });

  it('each element after the second is the sum of the two previous', () => {
    for (let i = 2; i < FIBONACCI.length; i++) {
      expect(FIBONACCI[i]).toBe(FIBONACCI[i - 1] + FIBONACCI[i - 2]);
    }
  });

  it('has at least 4 entries', () => {
    expect(FIBONACCI.length).toBeGreaterThanOrEqual(4);
  });
});

describe('TIMER_PRESETS', () => {
  it('has pomodoro preset', () => {
    expect(TIMER_PRESETS['pomodoro']).toBeDefined();
  });

  it('has desktime preset', () => {
    expect(TIMER_PRESETS['desktime']).toBeDefined();
  });

  it('has ultradian preset', () => {
    expect(TIMER_PRESETS['ultradian']).toBeDefined();
  });

  it('pomodoro has correct focus and break values', () => {
    const p = TIMER_PRESETS['pomodoro'] as TimerPreset;
    expect(p.focus).toBe(25);
    expect(p.break).toBe(5);
  });

  it('desktime has correct focus and break values', () => {
    const p = TIMER_PRESETS['desktime'] as TimerPreset;
    expect(p.focus).toBe(52);
    expect(p.break).toBe(17);
  });

  it('ultradian has correct focus and break values', () => {
    const p = TIMER_PRESETS['ultradian'] as TimerPreset;
    expect(p.focus).toBe(90);
    expect(p.break).toBe(20);
  });

  it('all presets have positive focus and break times', () => {
    for (const [, preset] of Object.entries(TIMER_PRESETS)) {
      expect((preset as TimerPreset).focus).toBeGreaterThan(0);
      expect((preset as TimerPreset).break).toBeGreaterThan(0);
    }
  });
});

describe('other constants', () => {
  it('BACKUP_ROTATION_COUNT is 3', () => {
    expect(BACKUP_ROTATION_COUNT).toBe(3);
  });

  it('DEFAULT_RETENTION_DAYS is 30', () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(30);
  });

  it('IPC_TIMEOUT_MS is a positive number', () => {
    expect(IPC_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
