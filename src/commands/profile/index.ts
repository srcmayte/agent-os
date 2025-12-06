/**
 * Profile Command Group
 * Groups profile-related commands: create
 */

import { Command } from 'commander';
import { createProfileCreateCommand } from './create.js';

/**
 * Create the profile command group
 */
export function createProfileCommand(): Command {
  const profile = new Command('profile').description('Profile management commands for Agent OS');

  profile.addCommand(createProfileCreateCommand());

  return profile;
}
