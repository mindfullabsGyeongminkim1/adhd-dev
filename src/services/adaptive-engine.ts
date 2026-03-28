import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { BASELINE_DAYS, CONSERVATIVE_DEFAULTS } from '../core/constants.js';
import { BASELINE_FILE, ensureHomeDir } from '../core/paths.js';
import { logInfo } from '../core/logger.js';
import type { AdaptiveParams, DaySignals, BaselineData } from '../core/types.js';

export function loadBaseline(filePath?: string): BaselineData | null {
  const target = filePath ?? BASELINE_FILE;
  if (!existsSync(target)) return null;
  try {
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw) as BaselineData;
  } catch {
    return null;
  }
}

function saveBaseline(data: BaselineData, filePath?: string): void {
  ensureHomeDir();
  const target = filePath ?? BASELINE_FILE;
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, target);
}

export function isBaselinePeriod(filePath?: string): boolean {
  const baseline = loadBaseline(filePath);
  if (!baseline) return true;
  return baseline.days.length < BASELINE_DAYS;
}

export function recordDaySignals(signals: DaySignals, filePath?: string): void {
  const existing = loadBaseline(filePath) ?? {
    startedAt: Date.now(),
    lastRecalcAt: Date.now(),
    days: [],
  };

  existing.days.push(signals);
  existing.lastRecalcAt = Date.now();

  saveBaseline(existing, filePath);
  logInfo('Recorded day signals', { date: signals.date });
}

export function recalculateParams(filePath?: string): AdaptiveParams {
  const baseline = loadBaseline(filePath);
  if (!baseline || baseline.days.length === 0) {
    return { ...CONSERVATIVE_DEFAULTS };
  }

  const days = baseline.days;
  const latest = days[days.length - 1];

  const params: AdaptiveParams = {
    signalFrequencyMultiplier: 1.0,
    signalIntensityLevel: 2,
    quietModeThreshold: 3,
    contextDetailLevel: 'normal',
    supportiveSilenceMode: false,
    hyperfocusAlert: false,
  };

  // Rule: High ignore rate → reduce signal frequency
  if (latest.signalIgnoreRate > 0.6) {
    params.signalFrequencyMultiplier = 0.5;
  }

  // Rule: Low productive time for long duration → supportive silence
  if (latest.productiveAppTimeRatio < 0.3 && latest.maxSessionLengthMin > 60) {
    params.supportiveSilenceMode = true;
    params.signalIntensityLevel = 1;
  }

  // Rule: High timer completion rate → reduce intensity
  if (latest.timerCompletionRate > 0.8) {
    params.signalIntensityLevel = 1;
  }

  // Rule: Many consecutive long sessions → hyperfocus alert
  if (latest.consecutiveSessions >= 3 && latest.maxSessionLengthMin > 30) {
    params.hyperfocusAlert = true;
  }

  // Clamp multiplier to [0.5, 1.5]
  params.signalFrequencyMultiplier = Math.max(0.5, Math.min(1.5, params.signalFrequencyMultiplier));

  return params;
}

export function getAdaptiveParams(filePath?: string): AdaptiveParams {
  if (isBaselinePeriod(filePath)) {
    return { ...CONSERVATIVE_DEFAULTS };
  }
  return recalculateParams(filePath);
}

export function isBadDayDetected(signals?: DaySignals, filePath?: string): boolean {
  if (signals) {
    return signals.productiveAppTimeRatio < 0.3 && signals.maxSessionLengthMin > 60;
  }

  const baseline = loadBaseline(filePath);
  if (!baseline || baseline.days.length === 0) return false;

  const latest = baseline.days[baseline.days.length - 1];
  return latest.productiveAppTimeRatio < 0.3 && latest.maxSessionLengthMin > 60;
}
