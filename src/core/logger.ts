import { appendFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { LOG_FILE, LOG_DIR } from './paths.js';
import { MAX_LOG_SIZE_BYTES } from './constants.js';

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return '';
  try {
    return ' ' + JSON.stringify(meta);
  } catch {
    return '';
  }
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  // No-op if log directory doesn't exist
  if (!existsSync(LOG_DIR)) return;

  try {
    // Rotate if file exceeds 10MB
    if (existsSync(LOG_FILE)) {
      const stats = statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE_BYTES) {
        writeFileSync(LOG_FILE, '', 'utf8');
      }
    }

    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${message}${formatMeta(meta)}\n`;
    appendFileSync(LOG_FILE, line, 'utf8');
  } catch {
    // Silently ignore logging errors
  }
}

export function logError(message: string, meta?: Record<string, unknown>): void {
  writeLog('ERROR', message, meta);
}

export function logWarn(message: string, meta?: Record<string, unknown>): void {
  writeLog('WARN', message, meta);
}

export function logInfo(message: string, meta?: Record<string, unknown>): void {
  writeLog('INFO', message, meta);
}

export function logDebug(message: string, meta?: Record<string, unknown>): void {
  writeLog('DEBUG', message, meta);
}
