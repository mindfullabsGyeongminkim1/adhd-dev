import * as readline from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import {
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  HIDE_CURSOR,
  SHOW_CURSOR,
  MOVE_HOME,
  CLEAR_SCREEN,
} from './ansi.js';
import { renderGridView, getCardDimensions } from './grid-view.js';
import { renderDetailView } from './detail-view.js';
import { discoverAgents } from '../services/agent-tracker.js';
import { getTimerStatus, startTimer, stopTimer } from '../services/timer-engine.js';
import { getTodayStats } from '../services/stats-aggregator.js';
import { DASHBOARD_REFRESH_MS, SPARKLES, ZZZ_FRAMES } from '../core/constants.js';
import { PROMPT_STATE_FILE } from '../core/paths.js';
import type { AgentInfo, PromptState } from '../core/types.js';

function readPromptState(): PromptState | null {
  if (!existsSync(PROMPT_STATE_FILE)) return null;
  try {
    const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
    return JSON.parse(raw) as PromptState;
  } catch {
    return null;
  }
}

function applyRuntimeEffects(
  output: string,
  agents: AgentInfo[],
  frame: number,
): string {
  let result = output;

  for (const agent of agents) {
    if (agent.state === 'sleeping') {
      // Add dim zZZ cycling text for sleeping agents
      const zzzFrame = ZZZ_FRAMES[frame % ZZZ_FRAMES.length] ?? ZZZ_FRAMES[0]!;
      // Append zZZ hint after project name occurrences
      const escapedName = agent.projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(${escapedName}\\s*)`, 'g');
      result = result.replace(re, (match, p1, offset, str) => {
        // Only replace the first occurrence to avoid duplication
        if (str.indexOf(match) === offset) {
          return `${p1}\x1b[2m${zzzFrame}\x1b[0m `;
        }
        return match;
      });
    }
  }

  return result;
}

export async function startDashboard(): Promise<void> {
  // Enter alt-screen, hide cursor
  process.stdout.write(ENTER_ALT_SCREEN + HIDE_CURSOR);

  let renderFrame = 0;
  let detailIndex: number | null = null;
  const prevTokens = new Map<string, number>();
  const prevLevels = new Map<string, number>();
  const flashSet = new Set<string>();
  const flashTimers = new Map<string, number>();
  const FLASH_FRAMES = 3;

  let running = true;

  function cleanup(): void {
    process.stdout.write(SHOW_CURSOR + EXIT_ALT_SCREEN);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }

  async function doRender(): Promise<void> {
    const agents = discoverAgents();
    const timer = getTimerStatus();
    const stats = getTodayStats();
    const promptState = readPromptState();

    // Track token deltas
    const tokenDeltas = new Map<string, number>();
    for (const agent of agents) {
      const prev = prevTokens.get(agent.sessionId) ?? agent.tokenUsage;
      tokenDeltas.set(agent.sessionId, agent.tokenUsage - prev);
      prevTokens.set(agent.sessionId, agent.tokenUsage);
    }

    // Track level-ups and flash
    for (const agent of agents) {
      const prev = prevLevels.get(agent.sessionId);
      if (prev !== undefined && agent.level > prev) {
        flashSet.add(agent.sessionId);
        flashTimers.set(agent.sessionId, FLASH_FRAMES);
      }
      prevLevels.set(agent.sessionId, agent.level);
    }

    // Decrement flash timers
    for (const [sessionId, framesLeft] of flashTimers) {
      if (framesLeft <= 1) {
        flashTimers.delete(sessionId);
        flashSet.delete(sessionId);
      } else {
        flashTimers.set(sessionId, framesLeft - 1);
      }
    }

    let output: string;

    if (detailIndex !== null && agents[detailIndex]) {
      output = renderDetailView(agents[detailIndex]!, agents, renderFrame);
    } else {
      output = renderGridView(agents, timer, stats, promptState, renderFrame, tokenDeltas, flashSet);
      output = applyRuntimeEffects(output, agents, renderFrame);
    }

    renderFrame++;

    // Clear screen then draw — ensures no stale lines in any terminal
    process.stdout.write(CLEAR_SCREEN + MOVE_HOME + output);
  }

  // Enable raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  // Set up keyboard handler
  process.stdin.on('data', (key: string) => {
    if (!running) return;

    if (key === 'q' || key === '\x03') {
      // q or Ctrl-C
      running = false;
      clearInterval(refreshInterval);
      cleanup();
      process.exit(0);
    } else if (key === 'r') {
      void doRender();
    } else if (key === 't') {
      // Toggle timer
      const timerStatus = getTimerStatus();
      if (timerStatus?.running) {
        stopTimer();
      } else {
        startTimer(25);
      }
      void doRender();
    } else if (key >= '1' && key <= '9') {
      // Switch to detail view
      const idx = parseInt(key, 10) - 1;
      detailIndex = idx;
      void doRender();
    } else if (key === 'b' || key === '\x1b') {
      // Back to grid view
      detailIndex = null;
      void doRender();
    }
  });

  // Initial render
  await doRender();

  // Set up refresh interval
  const refreshInterval = setInterval(() => {
    if (running) {
      void doRender();
    }
  }, DASHBOARD_REFRESH_MS);

  // Handle process signals
  process.on('SIGTERM', () => {
    running = false;
    clearInterval(refreshInterval);
    cleanup();
    process.exit(0);
  });
}
