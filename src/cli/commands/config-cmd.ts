import type { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../../core/config.js';
import type { Config } from '../../core/types.js';

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

function parseValue(raw: string): unknown {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const num = Number(raw);
  if (!isNaN(num) && raw.trim() !== '') return num;
  return raw;
}

export function register(program: Command): void {
  program
    .command('config [key] [value]')
    .description('View or set configuration values (dot-path: timer.defaultMinutes)')
    .action((key?: string, value?: string) => {
      const config = loadConfig();

      if (!key) {
        // Print full config
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      if (value === undefined) {
        // Print specific value
        const val = getNestedValue(config, key);
        if (val === undefined) {
          console.error(chalk.red(`Unknown config key: ${key}`));
          process.exit(1);
        }
        console.log(typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val));
        return;
      }

      // Set value
      const parsed = parseValue(value);
      const mutable = config as unknown as Record<string, unknown>;
      setNestedValue(mutable, key, parsed);
      saveConfig(mutable as unknown as Config);
      console.log(chalk.green(`Set ${key} = ${JSON.stringify(parsed)}`));
    });
}
