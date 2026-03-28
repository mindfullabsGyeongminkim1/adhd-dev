import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node-notifier before importing the service
vi.mock('node-notifier', () => ({
  default: {
    notify: vi.fn(),
  },
}));

// Mock loadConfig to control notification flags
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn(),
}));

import notifier from 'node-notifier';
import { loadConfig } from '../../src/core/config.js';
import { sendBell, sendSystemNotification, notifyTimerComplete } from '../../src/services/notification.js';
import type { Config } from '../../src/core/types.js';

const mockLoadConfig = vi.mocked(loadConfig);
const mockNotify = vi.mocked(notifier.notify);

function makeConfig(overrides: Partial<Config['notification']> = {}): Config {
  return {
    timer: { defaultMinutes: 25, breakMinutes: 5, preset: 'pomodoro' },
    notification: {
      sound: true,
      systemNotification: true,
      terminalBell: true,
      ...overrides,
    },
    dopamine: { signalLevel: 'on' },
    data: { retentionDays: 30 },
    daemon: { autoStart: false },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendBell', () => {
  it('writes \\x07 (bell character) to process.stdout', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    sendBell();
    expect(writeSpy).toHaveBeenCalledWith('\x07');
    writeSpy.mockRestore();
  });
});

describe('sendSystemNotification', () => {
  it('calls notifier.notify with title and message', () => {
    sendSystemNotification('Test Title', 'Test Message');
    expect(mockNotify).toHaveBeenCalledWith({ title: 'Test Title', message: 'Test Message' });
  });
});

describe('notifyTimerComplete', () => {
  it('fires both bell and notification when both flags are true', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    notifyTimerComplete(25);

    expect(writeSpy).toHaveBeenCalledWith('\x07');
    expect(mockNotify).toHaveBeenCalledTimes(1);
    writeSpy.mockRestore();
  });

  it('suppresses bell when terminalBell is false', () => {
    mockLoadConfig.mockReturnValue(makeConfig({ terminalBell: false }));
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    notifyTimerComplete(25);

    expect(writeSpy).not.toHaveBeenCalledWith('\x07');
    writeSpy.mockRestore();
  });

  it('suppresses system notification when systemNotification is false', () => {
    mockLoadConfig.mockReturnValue(makeConfig({ systemNotification: false }));
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    notifyTimerComplete(25);

    expect(mockNotify).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('suppresses both when both flags are false', () => {
    mockLoadConfig.mockReturnValue(makeConfig({ terminalBell: false, systemNotification: false }));
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    notifyTimerComplete(25);

    expect(writeSpy).not.toHaveBeenCalledWith('\x07');
    expect(mockNotify).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('passes sessionMinutes in the notification message', () => {
    mockLoadConfig.mockReturnValue(makeConfig());
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    notifyTimerComplete(52);

    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('52') }),
    );
  });
});
