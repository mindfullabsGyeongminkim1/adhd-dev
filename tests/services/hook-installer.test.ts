import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdirSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ─── Path mocking ───────────────────────────────────────────────────────────
// We override the paths module so hook-installer.ts uses our temp directories
// instead of the real ~/.claude/settings.json.

let tmpDir = '';
let settingsPath = '';
let hooksDir = '';
let claudeHome = '';

vi.mock('../../src/core/paths.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/core/paths.js')>();

  return {
    ...original,
    get CLAUDE_SETTINGS() {
      return settingsPath;
    },
    get CLAUDE_HOME() {
      return claudeHome;
    },
    get HOOKS_DIR() {
      return hooksDir;
    },
    ensureHomeDir() {
      mkdirSync(hooksDir, { recursive: true });
    },
  };
});

// Import AFTER mock is registered
const { installHooks, uninstallHooks, areHooksInstalled } = await import(
  '../../src/services/hook-installer.js'
);

// ─── Test Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  tmpDir = join(tmpdir(), `hook-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  claudeHome = join(tmpDir, '.claude');
  mkdirSync(claudeHome, { recursive: true });
  settingsPath = join(claudeHome, 'settings.json');
  hooksDir = join(tmpDir, '.adhd-dev', 'hooks');
});

afterEach(() => {
  vi.clearAllMocks();
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

interface ClaudeSettings {
  hooks?: {
    SessionStart?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    SessionStop?: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function readSettings(): ClaudeSettings {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8')) as ClaudeSettings;
  } catch {
    return {};
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('installHooks', () => {
  it('installs hooks on empty (nonexistent) settings.json', () => {
    const result = installHooks();
    expect(result.success).toBe(true);
    expect(result.backedUp).toBe(false);

    const settings = readSettings();
    expect(settings.hooks?.SessionStart).toHaveLength(1);
    expect(settings.hooks?.SessionStop).toHaveLength(1);
    expect(settings.hooks?.SessionStart?.[0].hooks[0].command).toContain('adhd-dev');
  });

  it('merges with existing hooks without removing them', () => {
    const existing: ClaudeSettings = {
      hooks: {
        SessionStart: [
          {
            matcher: 'other',
            hooks: [{ type: 'command', command: '/usr/local/bin/other-tool' }],
          },
        ],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(existing), 'utf8');

    installHooks();
    const settings = readSettings();

    expect(settings.hooks?.SessionStart).toHaveLength(2);
    const cmds =
      settings.hooks?.SessionStart?.flatMap((e) => e.hooks.map((h) => h.command)) ?? [];
    expect(cmds.some((c) => c.includes('other-tool'))).toBe(true);
    expect(cmds.some((c) => c.includes('adhd-dev'))).toBe(true);
  });

  it('does not duplicate adhd-dev hooks when called twice', () => {
    installHooks();
    installHooks();

    const settings = readSettings();
    const startCmds =
      settings.hooks?.SessionStart?.flatMap((e) => e.hooks.map((h) => h.command)) ?? [];
    expect(startCmds.filter((c) => c.includes('adhd-dev'))).toHaveLength(1);
  });

  it('3-rotate backup: creates bak.1 on first install', () => {
    writeFileSync(settingsPath, JSON.stringify({ version: 1 }), 'utf8');
    installHooks();
    expect(existsSync(`${settingsPath}.bak.1`)).toBe(true);
  });

  it('3-rotate backup: creates bak.1 and bak.2 on second install', () => {
    writeFileSync(settingsPath, JSON.stringify({ version: 1 }), 'utf8');
    installHooks();
    installHooks();
    expect(existsSync(`${settingsPath}.bak.1`)).toBe(true);
    expect(existsSync(`${settingsPath}.bak.2`)).toBe(true);
  });

  it('3-rotate backup: creates bak.1, bak.2, bak.3 on third install', () => {
    writeFileSync(settingsPath, JSON.stringify({ version: 1 }), 'utf8');
    installHooks();
    installHooks();
    installHooks();
    expect(existsSync(`${settingsPath}.bak.1`)).toBe(true);
    expect(existsSync(`${settingsPath}.bak.2`)).toBe(true);
    expect(existsSync(`${settingsPath}.bak.3`)).toBe(true);
  });

  it('sets backedUp=true when settings.json already exists', () => {
    writeFileSync(settingsPath, '{}', 'utf8');
    const result = installHooks();
    expect(result.backedUp).toBe(true);
  });
});

describe('uninstallHooks', () => {
  it('removes only adhd-dev hooks, preserving other hooks', () => {
    const SESSION_START_HOOK_CMD = '$HOME/.adhd-dev/hooks/session-start.sh';
    const SESSION_STOP_HOOK_CMD = '$HOME/.adhd-dev/hooks/session-stop.sh';
    const existing: ClaudeSettings = {
      hooks: {
        SessionStart: [
          { matcher: '', hooks: [{ type: 'command', command: SESSION_START_HOOK_CMD }] },
          { matcher: 'other', hooks: [{ type: 'command', command: '/usr/local/bin/other' }] },
        ],
        SessionStop: [
          { matcher: '', hooks: [{ type: 'command', command: SESSION_STOP_HOOK_CMD }] },
        ],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(existing), 'utf8');

    uninstallHooks();
    const settings = readSettings();

    expect(settings.hooks?.SessionStop).toBeUndefined();
    expect(settings.hooks?.SessionStart).toHaveLength(1);
    expect(settings.hooks?.SessionStart?.[0].hooks[0].command).toBe('/usr/local/bin/other');
  });

  it('succeeds when hooks key is absent', () => {
    writeFileSync(settingsPath, '{}', 'utf8');
    const result = uninstallHooks();
    expect(result.success).toBe(true);
  });

  it('succeeds when settings.json does not exist', () => {
    const result = uninstallHooks();
    expect(result.success).toBe(true);
  });
});

describe('areHooksInstalled', () => {
  it('returns false when settings.json does not exist', () => {
    expect(areHooksInstalled()).toBe(false);
  });

  it('returns false when hooks key is absent', () => {
    writeFileSync(settingsPath, '{}', 'utf8');
    expect(areHooksInstalled()).toBe(false);
  });

  it('returns true after installHooks', () => {
    installHooks();
    expect(areHooksInstalled()).toBe(true);
  });

  it('returns false after uninstallHooks', () => {
    installHooks();
    uninstallHooks();
    expect(areHooksInstalled()).toBe(false);
  });
});
