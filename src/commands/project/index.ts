/**
 * Project Command Group
 * Groups project-related commands: setup and sync
 */

import { Command } from 'commander';
import { createProjectSetupCommand } from './setup.js';
import { createProjectSyncCommand } from './sync.js';

/**
 * Create the project command group with setup and sync subcommands
 */
export function createProjectCommand(): Command {
  const project = new Command('project')
    .description('Project-related commands for Agent OS');

  project.addCommand(createProjectSetupCommand());
  project.addCommand(createProjectSyncCommand());

  return project;
}

export { performProjectSync } from './sync.js';
