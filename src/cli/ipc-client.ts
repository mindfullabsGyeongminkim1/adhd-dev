import * as net from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { SOCKET_PATH, PID_FILE } from '../core/paths.js';
import { IPC_TIMEOUT_MS } from '../core/constants.js';
import type { IpcRequest, IpcResponse } from '../core/types.js';

let requestIdCounter = 1;

export function sendRequest(
  method: string,
  params?: Record<string, unknown>,
  socketPath?: string,
): Promise<unknown> {
  const sockPath = socketPath ?? SOCKET_PATH;
  const id = requestIdCounter++;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(sockPath);
    let buffer = '';
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error(`IPC request timed out after ${IPC_TIMEOUT_MS}ms`));
      }
    }, IPC_TIMEOUT_MS);

    socket.on('connect', () => {
      const request: IpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        ...(params !== undefined && { params }),
      };
      socket.write(JSON.stringify(request) + '\n');
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const response = JSON.parse(trimmed) as IpcResponse;
          if (response.id === id) {
            if (!settled) {
              settled = true;
              clearTimeout(timeout);
              socket.destroy();

              if (response.error) {
                reject(new Error(`[${response.error.code}] ${response.error.message}`));
              } else {
                resolve(response.result);
              }
            }
          }
        } catch {
          // Ignore malformed response lines
        }
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    socket.on('close', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error('IPC connection closed before response'));
      }
    });
  });
}

export async function isDaemonRunning(socketPath?: string): Promise<boolean> {
  const sockPath = socketPath ?? SOCKET_PATH;

  // Check PID file exists
  if (!existsSync(PID_FILE)) {
    return false;
  }

  // Verify the PID is still alive
  try {
    const pidStr = readFileSync(PID_FILE, 'utf8').trim();
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) return false;

    // Send signal 0 to check if process is alive
    process.kill(pid, 0);
  } catch {
    return false;
  }

  // Check socket is connectable
  return new Promise((resolve) => {
    const socket = net.createConnection(sockPath);
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}
