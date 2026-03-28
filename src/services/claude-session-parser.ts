import { readFileSync, existsSync } from 'node:fs';
import type { ParsedSession } from '../core/types.js';

interface ContentPart {
  type: string;
  text?: string;
}

interface MessageUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface AssistantMessage {
  usage?: MessageUsage;
  content?: string | ContentPart[];
}

interface JsonlLine {
  type?: string;
  timestamp?: string | number;
  message?: AssistantMessage;
}

function extractTextFromContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .filter((part) => part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('');
  }
  return '';
}

export function parseJsonlFile(filePath: string): ParsedSession {
  if (!existsSync(filePath)) {
    return { totalTokens: 0, lastExchange: '', lastAssistantTimestamp: 0, lineCount: 0 };
  }

  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);

  let totalTokens = 0;
  let lastExchange = '';
  let lastAssistantTimestamp = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as JsonlLine;

      if (parsed.type === 'assistant' && parsed.message) {
        const msg = parsed.message;

        // Sum tokens, but exclude cache tokens
        if (msg.usage) {
          const input = msg.usage.input_tokens ?? 0;
          const output = msg.usage.output_tokens ?? 0;
          totalTokens += input + output;
        }

        // Extract last exchange text
        if (msg.content !== undefined) {
          const text = extractTextFromContent(msg.content);
          if (text.length > 0) {
            lastExchange = text;
          }
        }

        // Track timestamp — can be ISO string or epoch number
        if (parsed.timestamp) {
          const ts = typeof parsed.timestamp === 'string'
            ? new Date(parsed.timestamp).getTime()
            : parsed.timestamp;
          if (!isNaN(ts) && ts > lastAssistantTimestamp) {
            lastAssistantTimestamp = ts;
          }
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return {
    totalTokens,
    lastExchange,
    lastAssistantTimestamp,
    lineCount: lines.length,
  };
}
