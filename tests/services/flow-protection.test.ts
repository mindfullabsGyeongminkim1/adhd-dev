import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isFlowMode, setFlowMode } from '../../src/services/flow-protection.js';

let tmpDir: string;
let timerStateFile: string;

beforeEach(() => {
  tmpDir = join(
    tmpdir(),
    `flow-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(tmpDir, { recursive: true });
  timerStateFile = join(tmpDir, 'timer-state.json');
});

afterEach(() => {
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
});

describe('isFlowMode', () => {
  it('returns false when no timer-state.json exists', () => {
    expect(isFlowMode(timerStateFile)).toBe(false);
  });

  it('returns false before setFlowMode is called', () => {
    expect(isFlowMode(timerStateFile)).toBe(false);
  });
});

describe('setFlowMode', () => {
  it('setFlowMode(true) causes isFlowMode to return true', () => {
    setFlowMode(true, timerStateFile);
    expect(isFlowMode(timerStateFile)).toBe(true);
  });

  it('setFlowMode(false) causes isFlowMode to return false', () => {
    setFlowMode(true, timerStateFile);
    setFlowMode(false, timerStateFile);
    expect(isFlowMode(timerStateFile)).toBe(false);
  });

  it('creates timer-state.json when it does not exist', () => {
    expect(existsSync(timerStateFile)).toBe(false);
    setFlowMode(true, timerStateFile);
    expect(existsSync(timerStateFile)).toBe(true);
  });

  it('created timer-state.json contains valid JSON with flowMode set', () => {
    setFlowMode(true, timerStateFile);
    const raw = readFileSync(timerStateFile, 'utf8');
    const parsed = JSON.parse(raw) as { flowMode: boolean; running: boolean };
    expect(parsed.flowMode).toBe(true);
    expect(typeof parsed.running).toBe('boolean');
  });

  it('toggles flow mode correctly across multiple calls', () => {
    setFlowMode(false, timerStateFile);
    expect(isFlowMode(timerStateFile)).toBe(false);

    setFlowMode(true, timerStateFile);
    expect(isFlowMode(timerStateFile)).toBe(true);

    setFlowMode(false, timerStateFile);
    expect(isFlowMode(timerStateFile)).toBe(false);
  });
});
