#!/usr/bin/env node

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createScanCommand } from './commands/scan.js';
import { validateCommand } from './commands/validate.js';
import { createWebCommand } from './commands/web.js';

const program = new Command();

program
  .name('featuremap')
  .description('Visual feature map for your codebase')
  .version('0.1.0');

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createScanCommand());
program
  .command('validate')
  .description('Validate all .featuremap/ files against schemas')
  .option('-q, --quiet', 'Only output errors')
  .action(validateCommand);
program.addCommand(createWebCommand());

program.parse();
