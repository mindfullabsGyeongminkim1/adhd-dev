import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import type { Config } from './types.js';
import { CONFIG_FILE, ensureHomeDir } from './paths.js';

export function getDefaultConfig(): Config {
  return {
    timer: {
      defaultMinutes: 25,
      breakMinutes: 5,
      preset: 'pomodoro',
    },
    notification: {
      sound: true,
      systemNotification: true,
      terminalBell: true,
    },
    dopamine: {
      signalLevel: 'on',
    },
    data: {
      retentionDays: 30,
    },
    daemon: {
      autoStart: false,
    },
  };
}

export function loadConfig(configPath?: string): Config {
  const filePath = configPath ?? CONFIG_FILE;
  const defaults = getDefaultConfig();

  if (!existsSync(filePath)) {
    return defaults;
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Config>;

    return {
      timer: { ...defaults.timer, ...parsed.timer },
      notification: { ...defaults.notification, ...parsed.notification },
      dopamine: { ...defaults.dopamine, ...parsed.dopamine },
      data: { ...defaults.data, ...parsed.data },
      daemon: { ...defaults.daemon, ...parsed.daemon },
    };
  } catch {
    return defaults;
  }
}

export function saveConfig(config: Config, configPath?: string): void {
  const filePath = configPath ?? CONFIG_FILE;
  // Only ensure home dir when using the default path
  if (!configPath) ensureHomeDir();
  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(config, null, 2);
  writeFileSync(tmpPath, json, 'utf8');
  renameSync(tmpPath, filePath);
}
