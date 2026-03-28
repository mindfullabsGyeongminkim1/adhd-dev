import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseJsonlFile } from '../../src/services/claude-session-parser.js';

const FIXTURE_SESSION = join(
  process.cwd(),
  'tests/fixtures/projects/-test-project/test-session.jsonl'
);

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `parser-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('parseJsonlFile', () => {
  it('returns zero values for non-existent file', () => {
    const result = parseJsonlFile(join(tempDir, 'nonexistent.jsonl'));
    expect(result.totalTokens).toBe(0);
    expect(result.lastExchange).toBe('');
    expect(result.lastAssistantTimestamp).toBe(0);
    expect(result.lineCount).toBe(0);
  });

  it('counts tokens from fixture file (excludes cache tokens)', () => {
    const result = parseJsonlFile(FIXTURE_SESSION);
    // Line 2: input=100, output=50 (cache_creation=20, cache_read=10 are excluded)
    // Line 4: input=200, output=80
    // Line 6: input=50, output=30
    // Total: (100+50) + (200+80) + (50+30) = 150 + 280 + 80 = 510
    expect(result.totalTokens).toBe(510);
  });

  it('extracts last exchange from string content', () => {
    const result = parseJsonlFile(FIXTURE_SESSION);
    // The last assistant message has string content "Final answer here."
    expect(result.lastExchange).toBe('Final answer here.');
  });

  it('extracts last assistant timestamp', () => {
    const result = parseJsonlFile(FIXTURE_SESSION);
    // Last assistant message timestamp is 1710000040
    expect(result.lastAssistantTimestamp).toBe(1710000040);
  });

  it('counts all non-empty lines', () => {
    const result = parseJsonlFile(FIXTURE_SESSION);
    // 6 non-empty lines (including the malformed one)
    expect(result.lineCount).toBe(6);
  });

  it('handles array content format', () => {
    const filePath = join(tempDir, 'array-content.jsonl');
    writeFileSync(filePath, JSON.stringify({
      type: 'assistant',
      timestamp: 1710000100,
      message: {
        role: 'assistant',
        usage: { input_tokens: 10, output_tokens: 5 },
        content: [
          { type: 'text', text: 'Part one. ' },
          { type: 'text', text: 'Part two.' },
        ],
      },
    }) + '\n', 'utf8');

    const result = parseJsonlFile(filePath);
    expect(result.lastExchange).toBe('Part one. Part two.');
    expect(result.totalTokens).toBe(15);
    expect(result.lastAssistantTimestamp).toBe(1710000100);
  });

  it('handles mixed content array (filters non-text parts)', () => {
    const filePath = join(tempDir, 'mixed-content.jsonl');
    writeFileSync(filePath, JSON.stringify({
      type: 'assistant',
      timestamp: 1710000200,
      message: {
        role: 'assistant',
        usage: { input_tokens: 20, output_tokens: 10 },
        content: [
          { type: 'tool_use', id: 'tool1', name: 'read_file' },
          { type: 'text', text: 'I read the file.' },
        ],
      },
    }) + '\n', 'utf8');

    const result = parseJsonlFile(filePath);
    expect(result.lastExchange).toBe('I read the file.');
  });

  it('skips malformed lines and continues parsing', () => {
    const filePath = join(tempDir, 'with-malformed.jsonl');
    const lines = [
      JSON.stringify({
        type: 'assistant',
        timestamp: 1710000300,
        message: { usage: { input_tokens: 5, output_tokens: 3 }, content: 'First.' },
      }),
      'this is not valid json }{',
      JSON.stringify({
        type: 'assistant',
        timestamp: 1710000400,
        message: { usage: { input_tokens: 7, output_tokens: 4 }, content: 'Second.' },
      }),
    ].join('\n') + '\n';

    writeFileSync(filePath, lines, 'utf8');
    const result = parseJsonlFile(filePath);
    expect(result.totalTokens).toBe(5 + 3 + 7 + 4);
    expect(result.lastExchange).toBe('Second.');
    expect(result.lineCount).toBe(3);
  });

  it('handles empty file', () => {
    const filePath = join(tempDir, 'empty.jsonl');
    writeFileSync(filePath, '', 'utf8');
    const result = parseJsonlFile(filePath);
    expect(result.totalTokens).toBe(0);
    expect(result.lastExchange).toBe('');
    expect(result.lineCount).toBe(0);
  });

  it('ignores user-type lines for token counting', () => {
    const filePath = join(tempDir, 'user-only.jsonl');
    writeFileSync(filePath, JSON.stringify({
      type: 'user',
      timestamp: 1710000500,
      message: { role: 'user', content: 'Hello' },
    }) + '\n', 'utf8');

    const result = parseJsonlFile(filePath);
    expect(result.totalTokens).toBe(0);
    expect(result.lastExchange).toBe('');
  });
});
