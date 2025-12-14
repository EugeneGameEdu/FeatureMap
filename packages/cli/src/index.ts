#!/usr/bin/env node

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';
import { createScanCommand } from './commands/scan.js';

const program = new Command();

program
  .name('featuremap')
  .description('Visual feature map for your codebase')
  .version('0.1.0');

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createScanCommand());

program
  .command('web')
  .description('Start web interface')
  .action(() => {
    console.log('Web command - not implemented yet');
  });

program.parse();
