#!/usr/bin/env node

/**
 * Agent OS CLI
 * Your system for spec-driven agentic development
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  createInstallCommand,
  createProjectCommand,
  createCreateProfileCommand,
} from './commands/index.js';

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion(): string {
  try {
    // Try to read from package.json in parent directory (when built)
    const packagePath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version || '2.1.1';
  } catch {
    try {
      // Try to read from package.json in grandparent directory (when running with tsx)
      const packagePath = join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      return packageJson.version || '2.1.1';
    } catch {
      return '2.1.1';
    }
  }
}

/**
 * Create and configure the CLI program
 */
function createProgram(): Command {
  const program = new Command();

  program
    .name('agent-os')
    .description('Your system for spec-driven agentic development')
    .version(getVersion(), '-V, --version', 'Output the version number')
    .helpOption('-h, --help', 'Display help for command');

  // Add commands
  // `agent-os install` - Install Agent OS base to ~/agent-os
  program.addCommand(createInstallCommand());
  
  // `agent-os project setup|sync` - Project-related commands
  program.addCommand(createProjectCommand());
  
  // `agent-os create-profile` - Create a new profile
  program.addCommand(createCreateProfileCommand());

  // Add default action for no subcommand
  program.action(() => {
    program.outputHelp();
  });

  return program;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run
main();
