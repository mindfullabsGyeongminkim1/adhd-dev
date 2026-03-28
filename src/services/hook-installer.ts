import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAUDE_SETTINGS,
  CLAUDE_HOME,
  HOOKS_DIR,
  ensureHomeDir,
} from '../core/paths.js';
import { BACKUP_ROTATION_COUNT } from '../core/constants.js';

const SESSION_START_HOOK_CMD = '$HOME/.adhd-dev/hooks/session-start.sh';
const SESSION_STOP_HOOK_CMD = '$HOME/.adhd-dev/hooks/session-stop.sh';
const ADHD_DEV_MARKER = 'adhd-dev';

interface ClaudeSettings {
  hooks?: {
    SessionStart?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    SessionStop?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function readSettings(): ClaudeSettings {
  if (!existsSync(CLAUDE_SETTINGS)) {
    return {};
  }
  try {
    const raw = readFileSync(CLAUDE_SETTINGS, 'utf8');
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

function rotateBackups(): void {
  // bak.2 -> bak.3, bak.1 -> bak.2, current -> bak.1
  for (let i = BACKUP_ROTATION_COUNT; i >= 1; i--) {
    const from = i === 1 ? CLAUDE_SETTINGS : `${CLAUDE_SETTINGS}.bak.${i - 1}`;
    const to = `${CLAUDE_SETTINGS}.bak.${i}`;
    if (existsSync(from)) {
      try {
        renameSync(from, to);
      } catch {
        // Best-effort backup rotation
      }
    }
  }
}

function writeHookScripts(): void {
  ensureHomeDir();

  const sessionStartScript = join(HOOKS_DIR, 'session-start.sh');
  const sessionStopScript = join(HOOKS_DIR, 'session-stop.sh');
  const notificationScript = join(HOOKS_DIR, 'notification.sh');

  const sessionStartContent = [
    '#!/bin/bash',
    'SOCK="$HOME/.adhd-dev/adhd-dev.sock"',
    'if [ -S "$SOCK" ]; then',
    '  echo \'{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"session-start","ts":\'' + "$(date +%s)" + '\'}}\' | nc -U -w1 "$SOCK" 2>/dev/null',
    'else',
    '  echo \'{"event":"session-start","ts":\'' + "$(date +%s)" + '\'}\' >> "$HOME/.adhd-dev/events.jsonl"',
    'fi',
  ].join('\n') + '\n';

  const sessionStopContent = [
    '#!/bin/bash',
    'SOCK="$HOME/.adhd-dev/adhd-dev.sock"',
    'if [ -S "$SOCK" ]; then',
    '  echo \'{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"session-stop","ts":\'' + "$(date +%s)" + '\'}}\' | nc -U -w1 "$SOCK" 2>/dev/null',
    'else',
    '  echo \'{"event":"session-stop","ts":\'' + "$(date +%s)" + '\'}\' >> "$HOME/.adhd-dev/events.jsonl"',
    'fi',
  ].join('\n') + '\n';

  const notificationContent = [
    '#!/bin/bash',
    'SOCK="$HOME/.adhd-dev/adhd-dev.sock"',
    'if [ -S "$SOCK" ]; then',
    '  echo \'{"jsonrpc":"2.0","id":0,"method":"hook.event","params":{"event":"notification","ts":\'' + "$(date +%s)" + '\'}}\' | nc -U -w1 "$SOCK" 2>/dev/null',
    'fi',
  ].join('\n') + '\n';

  writeFileSync(sessionStartScript, sessionStartContent, { mode: 0o755 });
  writeFileSync(sessionStopScript, sessionStopContent, { mode: 0o755 });
  writeFileSync(notificationScript, notificationContent, { mode: 0o755 });
}

export function installHooks(): { success: boolean; backedUp: boolean } {
  try {
    // Write hook scripts first
    writeHookScripts();

    const settings = readSettings();
    let backedUp = false;

    // Rotate backups if settings.json exists
    if (existsSync(CLAUDE_SETTINGS)) {
      rotateBackups();
      backedUp = true;
    }

    // Ensure hooks object
    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Add SessionStart hook if not already present
    const sessionStartHooks = settings.hooks.SessionStart ?? [];
    const hasSessionStart = sessionStartHooks.some(
      (entry) =>
        entry.hooks?.some((h) => h.command?.includes(ADHD_DEV_MARKER)),
    );
    if (!hasSessionStart) {
      sessionStartHooks.push({
        matcher: '',
        hooks: [{ type: 'command', command: SESSION_START_HOOK_CMD }],
      });
    }
    settings.hooks.SessionStart = sessionStartHooks;

    // Add SessionStop hook if not already present
    const sessionStopHooks = settings.hooks.SessionStop ?? [];
    const hasSessionStop = sessionStopHooks.some(
      (entry) =>
        entry.hooks?.some((h) => h.command?.includes(ADHD_DEV_MARKER)),
    );
    if (!hasSessionStop) {
      sessionStopHooks.push({
        matcher: '',
        hooks: [{ type: 'command', command: SESSION_STOP_HOOK_CMD }],
      });
    }
    settings.hooks.SessionStop = sessionStopHooks;

    // Ensure claude home exists
    if (!existsSync(CLAUDE_HOME)) {
      mkdirSync(CLAUDE_HOME, { recursive: true });
    }

    writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2), 'utf8');

    return { success: true, backedUp };
  } catch {
    return { success: false, backedUp: false };
  }
}

export function uninstallHooks(): { success: boolean } {
  try {
    const settings = readSettings();

    if (!settings.hooks) {
      return { success: true };
    }

    // Remove adhd-dev SessionStart entries
    if (settings.hooks.SessionStart) {
      settings.hooks.SessionStart = settings.hooks.SessionStart.filter(
        (entry) =>
          !entry.hooks?.some((h) => h.command?.includes(ADHD_DEV_MARKER)),
      );
      if (settings.hooks.SessionStart.length === 0) {
        delete settings.hooks.SessionStart;
      }
    }

    // Remove adhd-dev SessionStop entries
    if (settings.hooks.SessionStop) {
      settings.hooks.SessionStop = settings.hooks.SessionStop.filter(
        (entry) =>
          !entry.hooks?.some((h) => h.command?.includes(ADHD_DEV_MARKER)),
      );
      if (settings.hooks.SessionStop.length === 0) {
        delete settings.hooks.SessionStop;
      }
    }

    if (existsSync(CLAUDE_SETTINGS)) {
      rotateBackups();
    }

    writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2), 'utf8');
    return { success: true };
  } catch {
    return { success: false };
  }
}

export function areHooksInstalled(): boolean {
  const settings = readSettings();
  if (!settings.hooks) return false;

  const checkList = [
    ...(settings.hooks.SessionStart ?? []),
    ...(settings.hooks.SessionStop ?? []),
  ];

  return checkList.some(
    (entry) => entry.hooks?.some((h) => h.command?.includes(ADHD_DEV_MARKER)),
  );
}
