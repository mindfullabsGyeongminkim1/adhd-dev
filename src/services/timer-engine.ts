import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import type { TimerState } from '../core/types.js';
import { TIMER_PRESETS } from '../core/constants.js';
import { TIMER_STATE_FILE, ensureHomeDir } from '../core/paths.js';
import { loadConfig } from '../core/config.js';

function writeStateAtomic(state: TimerState, filePath?: string): void {
  ensureHomeDir();
  const target = filePath ?? TIMER_STATE_FILE;
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmp, target);
}

function readState(filePath?: string): TimerState | null {
  const target = filePath ?? TIMER_STATE_FILE;
  if (!existsSync(target)) return null;
  try {
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

export function startTimer(minutes?: number, filePath?: string): TimerState {
  const config = loadConfig();
  const durationMin = minutes ?? config.timer.defaultMinutes;
  const state: TimerState = {
    running: true,
    startedAt: Date.now(),
    durationMs: durationMin * 60 * 1000,
    preset: config.timer.preset,
    flowMode: false,
    pausedAt: null,
  };
  writeStateAtomic(state, filePath);
  return state;
}

export function stopTimer(filePath?: string): TimerState {
  const existing = readState(filePath);
  const state: TimerState = {
    running: false,
    startedAt: existing?.startedAt ?? Date.now(),
    durationMs: existing?.durationMs ?? 25 * 60 * 1000,
    preset: existing?.preset ?? 'pomodoro',
    flowMode: existing?.flowMode ?? false,
    pausedAt: null,
  };
  writeStateAtomic(state, filePath);
  return state;
}

export function getTimerStatus(filePath?: string): TimerState | null {
  return readState(filePath);
}

export function applyPreset(name: string, filePath?: string): TimerState {
  const preset = TIMER_PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown preset: ${name}. Available: ${Object.keys(TIMER_PRESETS).join(', ')}`);
  }
  const existing = readState(filePath);
  const state: TimerState = {
    running: true,
    startedAt: Date.now(),
    durationMs: preset.focus * 60 * 1000,
    preset: name,
    flowMode: existing?.flowMode ?? false,
    pausedAt: null,
  };
  writeStateAtomic(state, filePath);
  return state;
}

export function getRemainingMs(filePath?: string): number {
  const state = readState(filePath);
  if (!state) return 0;
  const elapsed = Date.now() - state.startedAt;
  return state.durationMs - elapsed;
}

export function isTimerComplete(filePath?: string): boolean {
  const state = readState(filePath);
  if (!state || !state.running) return false;
  return getRemainingMs(filePath) <= 0;
}
