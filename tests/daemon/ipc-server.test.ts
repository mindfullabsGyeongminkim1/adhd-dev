import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as net from 'node:net';
import { startIpcServer, stopIpcServer } from '../../src/daemon/ipc-server.js';
import type { IpcRequest, IpcResponse } from '../../src/core/types.js';

let tmpDir: string;
let socketPath: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `ipc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
  socketPath = join(tmpDir, 'test.sock');
});

afterEach(async () => {
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

function sendRaw(sockPath: string, data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(sockPath);
    let response = '';

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('sendRaw timed out'));
    }, 3000);

    socket.on('connect', () => {
      socket.write(data);
    });

    socket.on('data', (chunk) => {
      response += chunk.toString('utf8');
      if (response.includes('\n')) {
        clearTimeout(timeout);
        socket.destroy();
        resolve(response);
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function makeRequest(id: number, method: string, params?: Record<string, unknown>): string {
  const req: IpcRequest = { jsonrpc: '2.0', id, method, ...(params && { params }) };
  return JSON.stringify(req) + '\n';
}

describe('startIpcServer / stopIpcServer', () => {
  it('starts and listens on the socket path', async () => {
    const handlers = {
      ping: async () => 'pong',
    };
    const server = await startIpcServer(handlers, socketPath);
    expect(existsSync(socketPath)).toBe(true);
    await stopIpcServer(server, socketPath);
  });

  it('cleans up stale socket file on startup', async () => {
    // Pre-create a stale socket file by starting and stopping one server
    const handlers = { ping: async () => 'pong' };
    const server1 = await startIpcServer(handlers, socketPath);
    // Don't stop cleanly; just close the underlying server without unlinking
    await new Promise<void>((resolve) => server1.close(() => resolve()));

    // Now start a new server on the same path — should succeed without EADDRINUSE
    const server2 = await startIpcServer(handlers, socketPath);
    expect(existsSync(socketPath)).toBe(true);
    await stopIpcServer(server2, socketPath);
  });

  it('removes socket file on stop', async () => {
    const handlers = { ping: async () => 'pong' };
    const server = await startIpcServer(handlers, socketPath);
    await stopIpcServer(server, socketPath);
    expect(existsSync(socketPath)).toBe(false);
  });
});

describe('valid request dispatching', () => {
  it('returns result for known method', async () => {
    const handlers = {
      'test.echo': async (params?: Record<string, unknown>) => params?.['value'],
    };
    const server = await startIpcServer(handlers, socketPath);

    const raw = await sendRaw(socketPath, makeRequest(1, 'test.echo', { value: 'hello' }));
    const response = JSON.parse(raw.trim()) as IpcResponse;

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result).toBe('hello');
    expect(response.error).toBeUndefined();

    await stopIpcServer(server, socketPath);
  });

  it('returns null result for void handler', async () => {
    const handlers = {
      'test.noop': async () => undefined,
    };
    const server = await startIpcServer(handlers, socketPath);

    const raw = await sendRaw(socketPath, makeRequest(42, 'test.noop'));
    const response = JSON.parse(raw.trim()) as IpcResponse;

    expect(response.id).toBe(42);
    expect(response.error).toBeUndefined();

    await stopIpcServer(server, socketPath);
  });
});

describe('error handling', () => {
  it('returns error -32601 for unknown method', async () => {
    const handlers = {};
    const server = await startIpcServer(handlers, socketPath);

    const raw = await sendRaw(socketPath, makeRequest(2, 'unknown.method'));
    const response = JSON.parse(raw.trim()) as IpcResponse;

    expect(response.id).toBe(2);
    expect(response.error).toBeDefined();
    expect(response.error?.code).toBe(-32601);
    expect(response.error?.message).toBe('Method not found');

    await stopIpcServer(server, socketPath);
  });

  it('returns error -32700 for malformed JSON', async () => {
    const handlers = {};
    const server = await startIpcServer(handlers, socketPath);

    const raw = await sendRaw(socketPath, 'not valid json\n');
    const response = JSON.parse(raw.trim()) as IpcResponse;

    expect(response.error?.code).toBe(-32700);
    expect(response.error?.message).toBe('Parse error');

    await stopIpcServer(server, socketPath);
  });

  it('returns error -32603 when handler throws', async () => {
    const handlers = {
      'test.throw': async () => {
        throw new Error('handler error');
      },
    };
    const server = await startIpcServer(handlers, socketPath);

    const raw = await sendRaw(socketPath, makeRequest(3, 'test.throw'));
    const response = JSON.parse(raw.trim()) as IpcResponse;

    expect(response.error?.code).toBe(-32603);
    expect(response.error?.message).toContain('handler error');

    await stopIpcServer(server, socketPath);
  });
});

describe('multiple concurrent connections', () => {
  it('handles two simultaneous clients', async () => {
    const handlers = {
      'test.id': async (params?: Record<string, unknown>) => params?.['id'],
    };
    const server = await startIpcServer(handlers, socketPath);

    const [r1, r2] = await Promise.all([
      sendRaw(socketPath, makeRequest(10, 'test.id', { id: 'client-a' })),
      sendRaw(socketPath, makeRequest(11, 'test.id', { id: 'client-b' })),
    ]);

    const resp1 = JSON.parse(r1.trim()) as IpcResponse;
    const resp2 = JSON.parse(r2.trim()) as IpcResponse;

    expect(resp1.result).toBe('client-a');
    expect(resp2.result).toBe('client-b');

    await stopIpcServer(server, socketPath);
  });
});
