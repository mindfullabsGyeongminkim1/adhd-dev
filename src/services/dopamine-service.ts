import { readFileSync, existsSync } from 'node:fs';
import { PROMPT_STATE_FILE } from '../core/paths.js';
import { HYPERFOCUS_THRESHOLD_MS } from '../core/constants.js';
import { logInfo } from '../core/logger.js';
import {
  onActivityDetected,
  onTimerComplete,
  onSessionIdle,
  writePromptState,
  getQuietMode,
} from './signal-emitter.js';
import { getAdaptiveParams } from './adaptive-engine.js';
import { notifyTimerComplete } from './notification.js';
import type { DopamineEvent, DopamineState, AgentInfo } from '../core/types.js';

// Internal state
let _timeOfDay: string = computeTimeOfDay();
let _warmth: string = 'neutral';

function computeTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'AM';
  if (hour >= 12 && hour < 18) return 'PM';
  return 'EVE';
}

function computeWarmth(agents: AgentInfo[]): string {
  const working = agents.filter((a) => a.state === 'working').length;
  if (working === 0) return 'cool';
  if (working === 1) return 'warm';
  return 'hot';
}

function checkHyperfocus(agents: AgentInfo[]): boolean {
  const now = Date.now();
  return agents.some((agent) => {
    if (agent.state !== 'working') return false;
    const continuousMs = now - agent.lastActivityAt;
    return continuousMs >= HYPERFOCUS_THRESHOLD_MS;
  });
}

export function handleEvent(event: DopamineEvent): void {
  logInfo('Dopamine event received', { type: event.type });

  switch (event.type) {
    case 'activity-detected': {
      // Momentum Pulse
      const signal = onActivityDetected();
      if (signal) {
        logInfo('Momentum pulse emitted', { badge: signal.data['badge'] });
      }
      break;
    }

    case 'session-stop': {
      // Return Bridge
      if (event.projectName) {
        onSessionIdle(event.projectName);
      }
      break;
    }

    case 'timer-complete': {
      // Completion Ripple
      onTimerComplete();
      notifyTimerComplete(0);
      break;
    }

    case 'level-up': {
      // Flash prompt state
      writePromptState({ pulse: 'flash' });
      logInfo('Level up flash emitted', { sessionId: event.sessionId });
      break;
    }

    case 'session-start':
    case 'timer-start':
      // No action for these event types in current implementation
      break;
  }
}

export function tick(agents: AgentInfo[]): void {
  // 1. Update timeOfDay
  _timeOfDay = computeTimeOfDay();

  // 2. Compute warmth from active agents
  _warmth = computeWarmth(agents);

  // 3. Check hyperfocus
  const hyperfocus = checkHyperfocus(agents);
  if (hyperfocus) {
    logInfo('Hyperfocus detected', { agentCount: agents.length });
  }

  // 4. Write prompt-state.json
  const adaptiveParams = getAdaptiveParams();
  writePromptState({
    timeOfDay: _timeOfDay,
    warmth: _warmth,
    ...(adaptiveParams.hyperfocusAlert || hyperfocus
      ? { pulse: 'hyperfocus' }
      : {}),
  });
}

export function getDopamineState(): DopamineState {
  // ETHICAL BOUNDARIES — hardcoded, never configurable:
  // - NEVER include streak data
  // - NEVER compare today vs yesterday automatically
  // - NEVER include "X minutes wasted"
  // - NEVER include inactive time ("N minutes away")
  // - NEVER punish via signal absence

  // Read current prompt state for latest warmth
  let currentWarmth = _warmth;
  if (existsSync(PROMPT_STATE_FILE)) {
    try {
      const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
      const state = JSON.parse(raw) as { warmth?: string };
      if (state.warmth) currentWarmth = state.warmth;
    } catch {
      // Use in-memory value
    }
  }

  return {
    timeOfDay: _timeOfDay,
    warmth: currentWarmth,
    quietMode: getQuietMode(),
    adaptiveParams: getAdaptiveParams(),
    // Explicitly excluded: streak, comparison, wasted time, inactive time
  };
}
