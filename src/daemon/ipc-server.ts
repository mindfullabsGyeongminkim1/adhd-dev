import * as net from 'node:net';
import { unlinkSync, existsSync } from 'node:fs';
import { SOCKET_PATH } from '../core/paths.js';
import { logInfo, logError, logWarn } from '../core/logger.js';
import type { IpcRequest, IpcResponse } from '../core/types.js';

export type MethodHandler = (params?: Record<string, unknown>) => Promise<unknown>;
export type MethodHandlers = Record<string, MethodHandler>;

const connectedSockets = new Set<net.Socket>();

function buildResponse(id: number, result?: unknown, error?: IpcResponse['error']): IpcResponse {
  const base: IpcResponse = { jsonrpc: '2.0', id };
  if (error !== undefined) {
    base.error = error;
  } else {
    base.result = result;
  }
  return base;
}

function handleConnection(socket: net.Socket, handlers: MethodHandlers): void {
  connectedSockets.add(socket);

  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    // Keep last incomplete fragment
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let request: IpcRequest;
      try {
        request = JSON.parse(trimmed) as IpcRequest;
      } catch {
        const errResponse = buildResponse(0, undefined, { code: -32700, message: 'Parse error' });
        socket.write(JSON.stringify(errResponse) + '\n');
        continue;
      }

      const { id, method, params } = request;

      const handler = handlers[method];
      if (!handler) {
        const errResponse = buildResponse(id, undefined, { code: -32601, message: 'Method not found' });
        socket.write(JSON.stringify(errResponse) + '\n');
        continue;
      }

      handler(params)
        .then((result) => {
          const response = buildResponse(id, result);
          socket.write(JSON.stringify(response) + '\n');
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Internal error';
          const errResponse = buildResponse(id, undefined, { code: -32603, message });
          socket.write(JSON.stringify(errResponse) + '\n');
        });
    }
  });

  socket.on('close', () => {
    connectedSockets.delete(socket);
  });

  socket.on('error', (err) => {
    logWarn('IPC socket error', { message: err.message });
    connectedSockets.delete(socket);
  });
}

export function startIpcServer(handlers: MethodHandlers, socketPath?: string): Promise<net.Server> {
  const sockPath = socketPath ?? SOCKET_PATH;

  // Clean up stale socket file
  if (existsSync(sockPath)) {
    try {
      unlinkSync(sockPath);
    } catch {
      // Ignore unlink errors
    }
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      handleConnection(socket, handlers);
    });

    server.on('error', (err) => {
      logError('IPC server error', { message: err.message });
      reject(err);
    });

    server.listen(sockPath, () => {
      logInfo('IPC server listening', { path: sockPath });
      resolve(server);
    });
  });
}

export function stopIpcServer(server: net.Server, socketPath?: string): Promise<void> {
  const sockPath = socketPath ?? SOCKET_PATH;

  return new Promise((resolve) => {
    // Destroy all connected sockets
    for (const socket of connectedSockets) {
      socket.destroy();
    }
    connectedSockets.clear();

    server.close(() => {
      if (existsSync(sockPath)) {
        try {
          unlinkSync(sockPath);
        } catch {
          // Ignore
        }
      }
      resolve();
    });
  });
}

export function broadcastToSubscribers(server: net.Server, data: unknown): void {
  const message = JSON.stringify(data) + '\n';
  for (const socket of connectedSockets) {
    if (!socket.destroyed) {
      socket.write(message);
    }
  }
}
