import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { ensureHomeDir, PID_FILE, SOCKET_PATH, PROMPT_STATE_FILE } from '../core/paths.js';
import { TICK_INTERVAL_MS } from '../core/constants.js';
import { loadConfig, saveConfig } from '../core/config.js';
import { logInfo, logError } from '../core/logger.js';
import { startIpcServer, stopIpcServer } from './ipc-server.js';
import { startWatching } from './file-watcher.js';
import { discoverAgents } from '../services/agent-tracker.js';
import { getTimerStatus, startTimer, stopTimer, applyPreset } from '../services/timer-engine.js';
import { getTodayStats } from '../services/stats-aggregator.js';
import { handleEvent, tick, getDopamineState } from '../services/dopamine-service.js';
import { isFlowMode, setFlowMode } from '../services/flow-protection.js';
import type { MethodHandlers } from './ipc-server.js';

const startedAt = Date.now();

async function main(): Promise<void> {
  logInfo('Daemon starting');

  // 1. Ensure home directory
  ensureHomeDir();

  // 2. Write PID file
  writeFileSync(PID_FILE, String(process.pid), 'utf8');
  logInfo('PID file written', { pid: process.pid, path: PID_FILE });

  // 3. Define method handlers
  const handlers: MethodHandlers = {
    'agent.list': async () => {
      return discoverAgents();
    },

    'agent.detail': async (params) => {
      const sessionId = params?.['sessionId'] as string | undefined;
      const agents = discoverAgents();
      const agent = agents.find((a) => a.sessionId === sessionId);
      if (!agent) throw new Error(`Agent not found: ${sessionId}`);
      return agent;
    },

    'timer.start': async (params) => {
      const minutes = params?.['minutes'] as number | undefined;
      return startTimer(minutes);
    },

    'timer.stop': async () => {
      return stopTimer();
    },

    'timer.status': async () => {
      return getTimerStatus();
    },

    'timer.preset': async (params) => {
      const name = params?.['name'] as string | undefined;
      if (!name) throw new Error('Missing preset name');
      return applyPreset(name);
    },

    'stats.today': async () => {
      return getTodayStats();
    },

    'flow.set': async (params) => {
      const enabled = Boolean(params?.['enabled']);
      setFlowMode(enabled);
      return { flowMode: enabled };
    },

    'config.get': async () => {
      return loadConfig();
    },

    'config.set': async (params) => {
      if (!params) throw new Error('Missing config params');
      const current = loadConfig();
      // Deep merge top-level keys
      const updated = { ...current };
      for (const key of Object.keys(params) as Array<keyof typeof current>) {
        if (key in current && typeof params[key] === 'object' && params[key] !== null) {
          (updated as Record<string, unknown>)[key] = {
            ...(current[key] as unknown as Record<string, unknown>),
            ...(params[key] as Record<string, unknown>),
          };
        }
      }
      saveConfig(updated);
      return updated;
    },

    'daemon.status': async () => {
      const agents = discoverAgents();
      return {
        running: true,
        pid: process.pid,
        uptime: Date.now() - startedAt,
        sessions: agents.length,
      };
    },

    'prompt.state': async () => {
      if (!existsSync(PROMPT_STATE_FILE)) return null;
      try {
        const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    'tmux.state': async () => {
      if (!existsSync(PROMPT_STATE_FILE)) return null;
      try {
        const raw = readFileSync(PROMPT_STATE_FILE, 'utf8');
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    'dopamine.state': async () => {
      return getDopamineState();
    },

    'hook.event': async (params) => {
      if (!params) throw new Error('Missing event params');
      handleEvent(params as unknown as Parameters<typeof handleEvent>[0]);
      return { ok: true };
    },
  };

  // 4. Start IPC server
  const server = await startIpcServer(handlers, SOCKET_PATH);
  logInfo('IPC server started');

  // 5. Start file watcher
  const watcher = startWatching((event) => {
    logInfo('File event received', { type: event.type, sessionId: event.sessionId });

    if (event.type === 'activity-detected') {
      handleEvent({
        type: 'activity-detected',
        sessionId: event.sessionId,
        timestamp: event.timestamp,
      });
    } else if (event.type === 'session-removed' && event.sessionId) {
      // Find the agent to get project name for return bridge
      const agents = discoverAgents();
      const agent = agents.find((a) => a.sessionId === event.sessionId);
      handleEvent({
        type: 'session-stop',
        sessionId: event.sessionId,
        projectName: agent?.projectName,
        timestamp: event.timestamp,
      });
    }
  });
  logInfo('File watcher started');

  // 6. Tick interval
  const tickInterval = setInterval(() => {
    try {
      const agents = discoverAgents();
      tick(agents);
    } catch (err) {
      logError('Tick error', { message: (err as Error).message });
    }
  }, TICK_INTERVAL_MS);

  logInfo('Daemon running', { pid: process.pid });

  // 7. Graceful shutdown
  async function shutdown(signal: string): Promise<void> {
    logInfo('Daemon shutting down', { signal });

    clearInterval(tickInterval);

    await watcher.stop();
    await stopIpcServer(server, SOCKET_PATH);

    if (existsSync(PID_FILE)) {
      try {
        unlinkSync(PID_FILE);
      } catch {
        // Ignore
      }
    }

    logInfo('Daemon stopped');
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logError('Daemon failed to start', { message: (err as Error).message });
  process.exit(1);
});
