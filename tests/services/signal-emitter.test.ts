import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock notification to avoid actual system calls
vi.mock('../../src/services/notification.js', () => ({
  sendBell: vi.fn(),
  sendSystemNotification: vi.fn(),
  notifyTimerComplete: vi.fn(),
}));

// Mock paths to use temp dir
let tmpDir: string;
let tmpPromptStateFile: string;

vi.mock('../../src/core/paths.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../../src/core/paths.js')>();
  return {
    ...orig,
    get PROMPT_STATE_FILE() {
      return tmpPromptStateFile;
    },
    ensureHomeDir: vi.fn(),
  };
});

import {
  onActivityDetected,
  onTimerComplete,
  onSessionIdle,
  writePromptState,
  canEmitProminentSignal,
  resetState,
  getQuietMode,
} from '../../src/services/signal-emitter.js';
import { sendBell, sendSystemNotification } from '../../src/services/notification.js';
import type { PromptState } from '../../src/core/types.js';

beforeEach(() => {
  tmpDir = join(tmpdir(), `signal-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  tmpPromptStateFile = join(tmpDir, 'prompt-state.json');
  resetState();
  vi.clearAllMocks();
});

afterEach(() => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
});

describe('onActivityDetected', () => {
  it('increments count and returns null for non-Fibonacci counts', () => {
    // First call: count=1 (not in FIBONACCI=[3,5,8,13,...])
    const result = onActivityDetected();
    expect(result).toBeNull();
  });

  it('returns a badge signal at Fibonacci boundary (count=3)', () => {
    // Advance to count=3
    onActivityDetected(); // 1
    onActivityDetected(); // 2
    const result = onActivityDetected(); // 3 → Fibonacci hit

    expect(result).not.toBeNull();
    expect(result?.type).toBe('prompt');
    expect(result?.data['badge']).toBe(3);
  });

  it('returns badge signal at count=5 (next Fibonacci)', () => {
    // count=3 will emit first, so put 5-min gap before count=5
    vi.spyOn(Date, 'now').mockReturnValue(0);
    onActivityDetected(); // 1
    onActivityDetected(); // 2
    onActivityDetected(); // 3 — emits at t=0

    // Advance past 5-min cooldown
    vi.spyOn(Date, 'now').mockReturnValue(MIN_PROMINENT_SIGNAL_INTERVAL_MS + 1);
    onActivityDetected(); // 4
    const result = onActivityDetected(); // 5 — Fibonacci, cooldown cleared
    expect(result?.data['badge']).toBe(5);
  });

  it('does not emit when within 5-minute cooldown', () => {
    // Force lastProminentSignalAt to be recent by triggering a successful emission
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    onActivityDetected(); // 1
    onActivityDetected(); // 2
    onActivityDetected(); // 3 — emits, sets lastProminentSignalAt

    // Only 1ms later — still in cooldown
    vi.spyOn(Date, 'now').mockReturnValue(1_000_001);
    onActivityDetected(); // 4
    onActivityDetected(); // 5 — Fibonacci but cooldown active
    const result = onActivityDetected(); // 5 is already counted, next is 8... let's advance
    // 6
    onActivityDetected(); // 7
    const r8 = onActivityDetected(); // 8 — Fibonacci, but cooldown
    expect(r8).toBeNull();
  });

  it('enters quiet mode after QUIET_MODE_IGNORE_COUNT (3) consecutive ignored signals', () => {
    // Set time so cooldown is initially ok
    const now = 0;
    vi.spyOn(Date, 'now').mockReturnValue(now);

    // Emit first signal at count=3
    onActivityDetected(); // 1
    onActivityDetected(); // 2
    onActivityDetected(); // 3 — emits, lastProminentSignalAt = 0

    // Now set time to still be within cooldown (1ms later)
    vi.spyOn(Date, 'now').mockReturnValue(1);

    // These will be Fibonacci hits but within cooldown → consecutive ignored increments
    // Need to reach FIBONACCI positions without crossing 5min cooldown
    // Count=5: ignored (cooldown)
    onActivityDetected(); // 4
    onActivityDetected(); // 5 — ignored → consecutiveIgnored=1

    // Count=8: ignored
    onActivityDetected(); // 6
    onActivityDetected(); // 7
    onActivityDetected(); // 8 — ignored → consecutiveIgnored=2

    // Count=13: ignored
    onActivityDetected(); // 9
    onActivityDetected(); // 10
    onActivityDetected(); // 11
    onActivityDetected(); // 12
    onActivityDetected(); // 13 — ignored → consecutiveIgnored=3 → quietMode=true

    expect(getQuietMode()).toBe(true);
  });
});

describe('canEmitProminentSignal', () => {
  it('returns true initially (no previous signal)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10_000_000);
    expect(canEmitProminentSignal()).toBe(true);
  });

  it('returns false in quiet mode', () => {
    // Force quiet mode by reaching QUIET_MODE_IGNORE_COUNT
    // Directly test via multiple ignores
    const baseTime = 0;
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    // Emit first signal
    onActivityDetected(); // 1
    onActivityDetected(); // 2
    onActivityDetected(); // 3 — emits

    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 1);

    onActivityDetected(); onActivityDetected(); // 4,5 — 5 ignored (1)
    onActivityDetected(); onActivityDetected(); onActivityDetected(); // 6,7,8 — 8 ignored (2)
    onActivityDetected(); onActivityDetected(); onActivityDetected(); onActivityDetected(); onActivityDetected(); // 9-13 — 13 ignored (3)

    // Now quiet mode should be active
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + MIN_PROMINENT_SIGNAL_INTERVAL_MS + 1);
    // Even after cooldown, quiet mode blocks it
    expect(canEmitProminentSignal()).toBe(false);
  });
});

// Import constant for test
import { MIN_PROMINENT_SIGNAL_INTERVAL_MS } from '../../src/core/constants.js';

describe('writePromptState', () => {
  it('writes a new prompt-state.json when none exists', () => {
    writePromptState({ pulse: 'test', badge: 5 });
    expect(existsSync(tmpPromptStateFile)).toBe(true);
    const content = JSON.parse(readFileSync(tmpPromptStateFile, 'utf8')) as PromptState;
    expect(content.pulse).toBe('test');
    expect(content.badge).toBe(5);
  });

  it('merges with existing state', () => {
    writePromptState({ pulse: 'first', badge: 3, warmth: 'warm' });
    writePromptState({ badge: 8 });
    const content = JSON.parse(readFileSync(tmpPromptStateFile, 'utf8')) as PromptState;
    // pulse should be preserved from first write
    expect(content.pulse).toBe('first');
    expect(content.badge).toBe(8);
    expect(content.warmth).toBe('warm');
  });

  it('updates the updated timestamp', () => {
    const before = Date.now();
    writePromptState({ pulse: 'x' });
    const content = JSON.parse(readFileSync(tmpPromptStateFile, 'utf8')) as PromptState;
    expect(content.updated).toBeGreaterThanOrEqual(before);
  });
});

describe('onTimerComplete', () => {
  it('calls sendBell and sendSystemNotification', () => {
    onTimerComplete();
    expect(sendBell).toHaveBeenCalledOnce();
    expect(sendSystemNotification).toHaveBeenCalledOnce();
  });
});

describe('onSessionIdle', () => {
  it('writes returnTo in prompt state', () => {
    onSessionIdle('my-project');
    const content = JSON.parse(readFileSync(tmpPromptStateFile, 'utf8')) as PromptState;
    expect(content.returnTo).toBe('my-project');
  });
});

describe('resetState', () => {
  it('clears all internal state', () => {
    onActivityDetected(); // 1
    onActivityDetected(); // 2
    onActivityDetected(); // 3 — emits (sets lastProminentSignalAt)
    resetState();

    // After reset, count is 0. Next call: count=1, not Fibonacci
    const result = onActivityDetected();
    expect(result).toBeNull();

    // canEmitProminentSignal should be true again
    expect(canEmitProminentSignal()).toBe(true);
    expect(getQuietMode()).toBe(false);
  });
});
