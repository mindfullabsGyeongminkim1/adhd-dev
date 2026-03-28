#!/usr/bin/env node
import { Command } from 'commander';
import { register as registerStatus } from './commands/status.js';
import { register as registerWhere } from './commands/where.js';
import { register as registerDash } from './commands/dash.js';
import { register as registerTimer } from './commands/timer.js';
import { register as registerToday } from './commands/today.js';
import { register as registerFlow } from './commands/flow.js';
import { register as registerInit } from './commands/init.js';
import { register as registerDoctor } from './commands/doctor.js';
import { register as registerConfigCmd } from './commands/config-cmd.js';
import { register as registerDaemonCmd } from './commands/daemon-cmd.js';
import { register as registerGo } from './commands/go.js';
import { register as registerHooks } from './commands/hooks.js';
import { register as registerReset } from './commands/reset.js';
import { register as registerPromptStatus } from './commands/prompt-status.js';
import { register as registerTmuxStatus } from './commands/tmux-status.js';
import { register as registerNotch } from './commands/notch.js';

const program = new Command();

program
  .name('adhd-dev')
  .description('CLI-integrated focus tool for ADHD developers')
  .version('0.1.0');

registerStatus(program);
registerWhere(program);
registerDash(program);
registerTimer(program);
registerToday(program);
registerFlow(program);
registerInit(program);
registerDoctor(program);
registerConfigCmd(program);
registerDaemonCmd(program);
registerGo(program);
registerHooks(program);
registerReset(program);
registerPromptStatus(program);
registerTmuxStatus(program);
registerNotch(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
