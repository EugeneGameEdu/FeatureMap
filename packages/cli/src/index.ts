#!/usr/bin/env node

import { Command } from 'commander';
import { createInitCommand } from './commands/init.js';

const program = new Command();

program
  .name('featuremap')
  .description('Visual feature map for your codebase')
  .version('0.1.0');

// Add commands
program.addCommand(createInitCommand());

program
  .command('scan')
  .description('Scan project and build feature map')
  .action(() => {
    console.log('Scan command - not implemented yet');
  });

program
  .command('web')
  .description('Start web interface')
  .action(() => {
    console.log('Web command - not implemented yet');
  });

program.parse();
