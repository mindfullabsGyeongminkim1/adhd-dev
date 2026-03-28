import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, saveConfig, getDefaultConfig } from '../../src/core/config.js';

let tempDir: string;
let configPath: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `adhd-dev-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  configPath = join(tempDir, 'config.json');
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('getDefaultConfig', () => {
  it('returns a full config object with expected defaults', () => {
    const config = getDefaultConfig();
    expect(config.timer.defaultMinutes).toBe(25);
    expect(config.timer.breakMinutes).toBe(5);
    expect(config.timer.preset).toBe('pomodoro');
    expect(config.notification.sound).toBe(true);
    expect(config.notification.systemNotification).toBe(true);
    expect(config.notification.terminalBell).toBe(true);
    expect(config.dopamine.signalLevel).toBe('on');
    expect(config.data.retentionDays).toBe(30);
    expect(config.daemon.autoStart).toBe(false);
  });
});

describe('loadConfig', () => {
  it('returns defaults when config file does not exist', () => {
    const config = loadConfig(configPath);
    const defaults = getDefaultConfig();
    expect(config).toEqual(defaults);
  });

  it('merges partial config with defaults', () => {
    const partial = { timer: { defaultMinutes: 52 } };
    writeFileSync(configPath, JSON.stringify(partial), 'utf8');
    const config = loadConfig(configPath);
    expect(config.timer.defaultMinutes).toBe(52);
    // Remaining timer fields should be defaults
    expect(config.timer.breakMinutes).toBe(5);
    expect(config.timer.preset).toBe('pomodoro');
    // Other sections should be defaults
    expect(config.notification.sound).toBe(true);
    expect(config.data.retentionDays).toBe(30);
  });

  it('returns defaults when config file has invalid JSON', () => {
    writeFileSync(configPath, 'not valid json', 'utf8');
    const config = loadConfig(configPath);
    expect(config).toEqual(getDefaultConfig());
  });

  it('loads fully specified config without modification', () => {
    const full = {
      timer: { defaultMinutes: 52, breakMinutes: 17, preset: 'desktime' },
      notification: { sound: false, systemNotification: false, terminalBell: false },
      dopamine: { signalLevel: 'subtle' },
      data: { retentionDays: 14 },
      daemon: { autoStart: true },
    };
    writeFileSync(configPath, JSON.stringify(full), 'utf8');
    const config = loadConfig(configPath);
    expect(config.timer.defaultMinutes).toBe(52);
    expect(config.timer.preset).toBe('desktime');
    expect(config.notification.sound).toBe(false);
    expect(config.dopamine.signalLevel).toBe('subtle');
    expect(config.data.retentionDays).toBe(14);
    expect(config.daemon.autoStart).toBe(true);
  });
});

describe('saveConfig', () => {
  it('round-trips config through save and load', () => {
    const config = getDefaultConfig();
    config.timer.defaultMinutes = 52;
    config.daemon.autoStart = true;
    saveConfig(config, configPath);

    const loaded = loadConfig(configPath);
    expect(loaded.timer.defaultMinutes).toBe(52);
    expect(loaded.daemon.autoStart).toBe(true);
  });

  it('writes valid JSON to the config file', () => {
    const config = getDefaultConfig();
    saveConfig(config, configPath);

    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.timer.defaultMinutes).toBe(25);
  });

  it('does not leave a .tmp file after save', () => {
    const config = getDefaultConfig();
    saveConfig(config, configPath);
    expect(existsSync(`${configPath}.tmp`)).toBe(false);
  });

  it('overwrites existing config on save', () => {
    const config1 = getDefaultConfig();
    config1.timer.defaultMinutes = 25;
    saveConfig(config1, configPath);

    const config2 = getDefaultConfig();
    config2.timer.defaultMinutes = 90;
    saveConfig(config2, configPath);

    const loaded = loadConfig(configPath);
    expect(loaded.timer.defaultMinutes).toBe(90);
  });
});
