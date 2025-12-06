/**
 * Base Command Group
 * Groups base-related commands: install, upgrade
 */

import { Command } from 'commander';
import { createBaseInstallCommand } from './install.js';

/**
 * Create the base install command
 * Since install is the main command at the root level, we export it directly
 */
export function createInstallCommand(): Command {
  return createBaseInstallCommand();
}
