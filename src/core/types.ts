// Agent states
export type AgentState = 'working' | 'idle' | 'sleeping';

// Core agent info returned by discovery pipeline
export interface AgentInfo {
  pid: number;
  sessionId: string;
  cwd: string;
  projectName: string;
  startedAt: number;
  state: AgentState;
  tokenUsage: number;
  rawTokenUsage: number;
  level: number;
  lastExchange: string;
  lastActivityAt: number;
  jsonlPath: string | null;
}

// Timer
export interface TimerState {
  running: boolean;
  startedAt: number;
  durationMs: number;
  preset: string;
  flowMode: boolean;
  pausedAt: number | null;
}

export interface TimerPreset {
  focus: number;
  break: number;
}

// Prompt state (written by daemon, read by prompt-status)
export interface PromptState {
  pulse: string;
  badge: number | null;
  timer: string | null;
  timeOfDay: string;
  returnTo: string | null;
  warmth: string;
  updated: number;
}

// Config
export interface TimerConfig {
  defaultMinutes: number;
  breakMinutes: number;
  preset: string;
}

export interface NotificationConfig {
  sound: boolean;
  systemNotification: boolean;
  terminalBell: boolean;
}

export interface DopamineConfig {
  signalLevel: 'on' | 'subtle' | 'off';
}

export interface DataConfig {
  retentionDays: number;
}

export interface DaemonConfig {
  autoStart: boolean;
}

export interface Config {
  timer: TimerConfig;
  notification: NotificationConfig;
  dopamine: DopamineConfig;
  data: DataConfig;
  daemon: DaemonConfig;
}

// Daily stats
export interface DayStats {
  focusMinutes: number;
  completedSessions: number;
  date: string;
}

// Adaptive engine
export interface DaySignals {
  date: string;
  productiveAppTimeRatio: number;
  sessionSwitchFrequency: number;
  timerCompletionRate: number;
  popoverFrequency: number;
  signalIgnoreRate: number;
  consecutiveSessions: number;
  maxSessionLengthMin: number;
}

export interface AdaptiveParams {
  signalFrequencyMultiplier: number;
  signalIntensityLevel: 1 | 2 | 3;
  quietModeThreshold: number;
  contextDetailLevel: 'brief' | 'normal' | 'detailed';
  supportiveSilenceMode: boolean;
  hyperfocusAlert: boolean;
}

// Daemon status
export interface DaemonStatus {
  running: boolean;
  pid: number;
  uptime: number;
  sessions: number;
}

// IPC protocol (JSON-RPC 2.0)
export interface IpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface IpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Dopamine events
export type DopamineEventType =
  | 'activity-detected'
  | 'session-start'
  | 'session-stop'
  | 'timer-complete'
  | 'timer-start'
  | 'level-up';

export interface DopamineEvent {
  type: DopamineEventType;
  sessionId?: string;
  projectName?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

// Signal types for dopamine output
export type SignalType = 'prompt' | 'bell' | 'notification' | 'tmux' | 'title';

export interface Signal {
  type: SignalType;
  data: Record<string, unknown>;
  force?: boolean;
}

// Raw session from PID.json
export interface RawSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint?: string;
}

// Parsed JSONL result
export interface ParsedSession {
  totalTokens: number;
  lastExchange: string;
  lastAssistantTimestamp: number;
  lineCount: number;
}

// File watcher events
export type FileEventType = 'session-discovered' | 'session-removed' | 'activity-detected';

export interface FileEvent {
  type: FileEventType;
  sessionId?: string;
  path: string;
  timestamp: number;
}

// Baseline data
export interface BaselineData {
  startedAt: number;
  lastRecalcAt: number;
  days: DaySignals[];
}

// Dopamine state (for TUI)
export interface DopamineState {
  timeOfDay: string;
  warmth: string;
  quietMode: boolean;
  adaptiveParams: AdaptiveParams;
}
