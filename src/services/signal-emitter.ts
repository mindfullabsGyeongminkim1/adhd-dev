import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import {
  FIBONACCI,
  MIN_PROMINENT_SIGNAL_INTERVAL_MS,
  QUIET_MODE_IGNORE_COUNT,
} from '../core/constants.js';
import { PROMPT_STATE_FILE, ensureHomeDir } from '../core/paths.js';
import { sendBell, sendSystemNotification } from './notification.js';
import { logInfo } from '../core/logger.js';
import type { PromptState, Signal } from '../core/types.js';

// Internal state
let exchangeCount = 0;
let lastProminentSignalAt = 0;
let consecutiveIgnored = 0;
let quietMode = false;

export function canEmitProminentSignal(): boolean {
  if (quietMode) return false;
  const now = Date.now();
  return now - lastProminentSignalAt >= MIN_PROMINENT_SIGNAL_INTERVAL_MS;
}

export function onActivityDetected(): Signal | null {
  exchangeCount++;

  if (!FIBONACCI.includes(exchangeCount)) {
    return null;
  }

  if (!canEmitProminentSignal()) {
    consecutiveIgnored++;
    if (consecutiveIgnored >= QUIET_MODE_IGNORE_COUNT) {
      quietMode = true;
      logInfo('Signal emitter entering quiet mode', { consecutiveIgnored });
    }
    return null;
  }

  // Emit badge signal
  lastProminentSignalAt = Date.now();
  consecutiveIgnored = 0;

  const signal: Signal = {
    type: 'prompt',
    data: { badge: exchangeCount },
  };

  writePromptState({ badge: exchangeCount });

  return signal;
}

export function onTimerComplete(): void {
  sendBell();
  sendSystemNotification('ADHD-Dev: Focus Complete', 'Timer finished. Take a break!');
  logInfo('Timer complete signal emitted');
}

export function onSessionIdle(projectName: string): void {
  writePromptState({ returnTo: projectName });
  logInfo('Return bridge signal emitted', { projectName });
}

export function writePromptState(state: Partial<PromptState>): void {
  ensureHomeDir();

  let current: PromptState = {
    pulse: '',
    badge: null,
    timer: null,
    timeOfDay: '',
    returnTo: null,
    warmth: '',
    updated: Date.now(),
  };

  if (existsSync(PROMPT_STATE_FILE)) {
    try {
      const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
      current = JSON.parse(raw) as PromptState;
    } catch {
      // Use defaults on parse error
    }
  }

  const merged: PromptState = {
    ...current,
    ...state,
    updated: Date.now(),
  };

  const tmp = `${PROMPT_STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
  renameSync(tmp, PROMPT_STATE_FILE);
}

export function resetState(): void {
  exchangeCount = 0;
  lastProminentSignalAt = 0;
  consecutiveIgnored = 0;
  quietMode = false;
}

export function getQuietMode(): boolean {
  return quietMode;
}
