/**
 * Base Install Command
 * Installs Agent OS from GitHub repository to ~/agent-os
 */

import { Command } from 'commander';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import ora from 'ora';
import inquirer from 'inquirer';
import {
  printSection,
  printStatus,
  printSuccess,
  printError,
  printWarning,
  setVerbose,
  Colors,
  printCompletion,
} from '../../utils/output.js';
import { getYamlValue } from '../../utils/yaml.js';
import { ensureDir } from '../../utils/filesystem.js';
import { createTimestampedBackup } from '../../utils/backup.js';
import type { BaseInstallOptions } from '../../types/index.js';
import {
  REPO_URL,
  BASE_DIR,
  getLatestVersion,
  downloadFile,
  downloadFilesFromGitHub,
  downloadAllFiles,
} from './shared.js';

/**
 * Create install command (base installation)
 */
export function createBaseInstallCommand(): Command {
  const command = new Command('install')
    .description('Install Agent OS base installation to ~/agent-os')
    .option('-v, --verbose', 'Show verbose output')
    .action(async (options: BaseInstallOptions) => {
      await runBaseInstall(options);
    });

  return command;
}

/**
 * Run base installation
 */
async function runBaseInstall(options: BaseInstallOptions): Promise<void> {
  printSection('Agent OS Base Installation');

  if (options.verbose) {
    setVerbose(true);
  }

  // Check for existing installation
  if (existsSync(BASE_DIR)) {
    await handleExistingInstallation();
  } else {
    await performFreshInstallation();
  }
}

/**
 * Handle existing installation
 */
async function handleExistingInstallation(): Promise<void> {
  // Get current version
  let currentVersion = '';
  const configPath = join(BASE_DIR, 'config.yml');
  if (existsSync(configPath)) {
    currentVersion = getYamlValue(configPath, 'version', '');
  }

  // Get latest version from GitHub
  const latestVersion = await getLatestVersion();

  await promptOverwriteChoice(currentVersion, latestVersion);
}

/**
 * Prompt for overwrite choice - supports multi-select for specific updates
 */
async function promptOverwriteChoice(
  currentVersion: string,
  latestVersion: string
): Promise<void> {
  console.log('');
  console.log(`${Colors.YELLOW}=== ⚠️  Existing Installation Detected ===${Colors.RESET}`);
  console.log('');
  console.log('You already have a base installation of Agent OS');

  if (currentVersion) {
    console.log(`  Your installed version: ${Colors.YELLOW}${currentVersion}${Colors.RESET}`);
  } else {
    console.log('  Your installed version: (unknown)');
  }

  if (latestVersion) {
    console.log(`  Latest available version: ${Colors.YELLOW}${latestVersion}${Colors.RESET}`);
  } else {
    console.log('  Latest available version: (unable to determine)');
  }

  console.log('');
  printStatus('What would you like to do?');
  console.log('');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Select an option:',
      choices: [
        {
          name: '1) Full update - Updates profiles/default/*, CHANGELOG.md, and version',
          value: 'full',
        },
        {
          name: '2) Select specific updates - Choose which components to update',
          value: 'select',
        },
        {
          name: '3) Delete & reinstall fresh - Backs up and reinstalls everything',
          value: 'reinstall',
        },
        {
          name: '4) Cancel and abort',
          value: 'cancel',
        },
      ],
    },
  ]);

  switch (action) {
    case 'full':
      console.log('');
      printStatus('Performing full update...');
      createTimestampedBackup(BASE_DIR);
      console.log('');
      await fullUpdate(latestVersion);
      break;
    case 'select':
      await promptSelectiveUpdate(latestVersion);
      break;
    case 'reinstall':
      console.log('');
      printStatus('Deleting & reinstalling fresh...');
      await overwriteAll();
      break;
    case 'cancel':
      console.log('');
      printWarning('Installation cancelled');
      return;
  }
}

/**
 * Prompt for selective updates - allows multiple selection
 */
async function promptSelectiveUpdate(latestVersion: string): Promise<void> {
  const { updates } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'updates',
      message: 'Select components to update (use space to select, enter to confirm):',
      choices: [
        {
          name: 'Default profile (profiles/default/*)',
          value: 'profile',
        },
        {
          name: 'Config file (config.yml)',
          value: 'config',
        },
        {
          name: 'Changelog (CHANGELOG.md)',
          value: 'changelog',
        },
      ],
    },
  ]);

  if (updates.length === 0) {
    console.log('');
    printWarning('No updates selected');
    return;
  }

  console.log('');
  printStatus(`Updating ${updates.length} component(s)...`);
  createTimestampedBackup(BASE_DIR);
  console.log('');

  for (const update of updates) {
    switch (update) {
      case 'profile':
        await overwriteProfile();
        break;
      case 'config':
        await overwriteConfig();
        break;
      case 'changelog':
        await updateChangelog();
        break;
    }
  }

  // Update version if config was updated or if explicitly requested
  if (latestVersion && updates.includes('config')) {
    await updateVersion(latestVersion);
  }

  console.log('');
  printSuccess('Selected updates completed!');
}

/**
 * Full update
 */
async function fullUpdate(latestVersion: string): Promise<void> {
  // Update default profile
  await overwriteProfile();

  // Update CHANGELOG.md
  await updateChangelog();

  // Update version in config.yml
  if (latestVersion) {
    await updateVersion(latestVersion);
  }

  console.log('');
  printSuccess('Full update completed!');
}

/**
 * Update version in config.yml
 */
async function updateVersion(latestVersion: string): Promise<void> {
  printStatus('Updating version number in config.yml...');
  const configPath = join(BASE_DIR, 'config.yml');
  if (existsSync(configPath)) {
    const { readFileSync, writeFileSync } = await import('fs');
    let content = readFileSync(configPath, 'utf-8');
    content = content.replace(/^version:.*/m, `version: ${latestVersion}`);
    writeFileSync(configPath, content);
    printSuccess(`Updated version to ${latestVersion} in config.yml`);
  }
  console.log('');
}

/**
 * Update changelog
 */
async function updateChangelog(): Promise<void> {
  printStatus('Updating CHANGELOG.md...');
  await downloadFile('CHANGELOG.md', join(BASE_DIR, 'CHANGELOG.md'));
  printSuccess('Updated CHANGELOG.md');
  console.log('');
}

/**
 * Overwrite default profile only
 */
async function overwriteProfile(): Promise<void> {
  printStatus('Updating default profile...');
  rmSync(join(BASE_DIR, 'profiles', 'default'), { recursive: true, force: true });
  const files = await downloadFilesFromGitHub('profiles/default');
  printSuccess(`Updated default profile (${files.length} files)`);
  console.log('');
}

/**
 * Overwrite config only
 */
async function overwriteConfig(): Promise<void> {
  printStatus('Updating config.yml...');
  await downloadFile('config.yml', join(BASE_DIR, 'config.yml'));
  printSuccess('Updated config.yml');
  console.log('');
}

/**
 * Delete everything and reinstall fresh
 */
async function overwriteAll(): Promise<void> {
  createTimestampedBackup(BASE_DIR);
  console.log('');

  rmSync(BASE_DIR, { recursive: true, force: true });
  await performFreshInstallation();
}

/**
 * Perform fresh installation
 */
async function performFreshInstallation(): Promise<void> {
  console.log('');
  printStatus('Configuration:');
  console.log(`  Repository: ${Colors.YELLOW}${REPO_URL}${Colors.RESET}`);
  console.log(`  Target: ${Colors.YELLOW}~/agent-os${Colors.RESET}`);
  console.log('');

  // Create base directory
  ensureDir(BASE_DIR);
  printSuccess('Created base directory: ~/agent-os');
  console.log('');

  // Install all files from repository
  const spinner = ora('Installing Agent OS files').start();

  try {
    const fileCount = await downloadAllFiles();
    spinner.succeed(`Installed ${fileCount} files to ~/agent-os`);
  } catch (err) {
    spinner.fail('Installation failed');
    printError(String(err));
    process.exit(1);
  }

  console.log('');
  printSuccess('Agent OS has been successfully installed!');

  printCompletion('Installation complete!', [
    "Customize your profile's standards in ~/agent-os/profiles/default/standards",
    'Navigate to a project directory: cd path/to/project-directory',
    'Install Agent OS in your project: agent-os project setup',
  ]);

  console.log(
    `${Colors.GREEN}Visit the docs for guides on how to use Agent OS: https://buildermethods.com/agent-os${Colors.RESET}`
  );
  console.log('');
}
