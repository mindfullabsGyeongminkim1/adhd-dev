import notifier from 'node-notifier';
import { loadConfig } from '../core/config.js';

export function sendBell(): void {
  process.stdout.write('\x07');
}

export function sendSystemNotification(title: string, message: string): void {
  notifier.notify({ title, message });
}

export function notifyTimerComplete(sessionMinutes: number): void {
  const config = loadConfig();
  const { terminalBell, systemNotification } = config.notification;

  if (terminalBell) {
    sendBell();
  }

  if (systemNotification) {
    sendSystemNotification(
      'ADHD-Dev: Focus Session Complete',
      `Great work! ${sessionMinutes} minute session finished.`,
    );
  }
}
