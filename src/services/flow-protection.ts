import { getTimerStatus, stopTimer } from './timer-engine.js';
import { TIMER_STATE_FILE } from '../core/paths.js';
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { ensureHomeDir } from '../core/paths.js';
import type { TimerState } from '../core/types.js';

function readRawState(filePath?: string): TimerState | null {
  const target = filePath ?? TIMER_STATE_FILE;
  if (!existsSync(target)) return null;
  try {
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

function writeStateAtomic(state: TimerState, filePath?: string): void {
  ensureHomeDir();
  const target = filePath ?? TIMER_STATE_FILE;
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, target);
}

export function isFlowMode(filePath?: string): boolean {
  const state = readRawState(filePath);
  return state?.flowMode ?? false;
}

export function setFlowMode(enabled: boolean, filePath?: string): void {
  const state = readRawState(filePath);
  if (!state) {
    // No timer state yet; create a minimal stopped state with flowMode set
    const newState: TimerState = {
      running: false,
      startedAt: Date.now(),
      durationMs: 25 * 60 * 1000,
      preset: 'pomodoro',
      flowMode: enabled,
      pausedAt: null,
    };
    writeStateAtomic(newState, filePath);
    return;
  }
  writeStateAtomic({ ...state, flowMode: enabled }, filePath);
}
