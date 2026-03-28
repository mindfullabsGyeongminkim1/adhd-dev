import type { AdaptiveParams, TimerPreset } from './types.js';

// Level thresholds (token count)
export const LEVEL_THRESHOLDS = [0, 1_000, 10_000, 50_000, 200_000];
export const LEVEL_NAMES = ['Baby', 'Juvenile', 'Adult', 'Warrior', 'King'];
export const LEVEL_COLORS = ['gray', 'cyan', 'green', 'yellow', 'red'] as const;

// Fibonacci sequence for momentum pulse badges
export const FIBONACCI = [3, 5, 8, 13, 21, 34, 55, 89];

// Daemon tick interval
export const TICK_INTERVAL_MS = 10_000;

// Token decay rates (per hour)
export const DECAY_RATE_IDLE = 0.02;
export const DECAY_RATE_SLEEPING = 0.05;

// Session state thresholds
export const WORKING_THRESHOLD_MS = 2 * 60 * 1000;       // 2 minutes
export const IDLE_THRESHOLD_MS = 15 * 60 * 1000;          // 15 minutes

// Signal emission limits
export const MIN_PROMINENT_SIGNAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const QUIET_MODE_IGNORE_COUNT = 3;

// Hyperfocus detection
export const HYPERFOCUS_THRESHOLD_MS = 90 * 60 * 1000;    // 90 minutes

// Timer presets
export const TIMER_PRESETS: Record<string, TimerPreset> = {
  pomodoro:  { focus: 25, break: 5 },
  desktime:  { focus: 52, break: 17 },
  ultradian: { focus: 90, break: 20 },
};

// Conservative defaults for adaptive engine (baseline period)
export const CONSERVATIVE_DEFAULTS: AdaptiveParams = {
  signalFrequencyMultiplier: 1.0,
  signalIntensityLevel: 2,
  quietModeThreshold: 3,
  contextDetailLevel: 'normal',
  supportiveSilenceMode: false,
  hyperfocusAlert: false,
};

// Baseline collection period
export const BASELINE_DAYS = 7;

// Data retention
export const DEFAULT_RETENTION_DAYS = 30;

// Log rotation
export const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// IPC timeout
export const IPC_TIMEOUT_MS = 5_000;

// Dashboard refresh
export const DASHBOARD_REFRESH_MS = 2_000;

// Animation frames
export const ANIMATION_FRAMES = 4;

// Hook backup rotation count
export const BACKUP_ROTATION_COUNT = 3;

// Sparkle characters for complete state
export const SPARKLES = ['✨', '·', '★', '⭐', '✦', '•', '∗'];

// Sleep animation frames
export const ZZZ_FRAMES = ['  z', ' zZ', 'zZZ', ' zZ'];

// ASCII density characters for hires rendering
export const DENSITY_CHARS = ' .·:;+x%#@█';
