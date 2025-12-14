#!/usr/bin/env node

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createScanCommand } from './commands/scan.js';
import { createWebCommand } from './commands/web.js';

const program = new Command();

program
  .name('featuremap')
  .description('Visual feature map for your codebase')
  .version('0.1.0');

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createScanCommand());
program.addCommand(createWebCommand());

program.parse();
