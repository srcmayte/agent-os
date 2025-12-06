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

// Re-export shared utilities for use in other modules
export {
  REPO_URL,
  BASE_DIR,
  getRepoApiUrl,
  getRepoFiles,
  downloadFile,
  downloadFilesFromGitHub,
  downloadAllFiles,
  getLatestVersion,
  getCurrentVersion,
} from './shared.js';
