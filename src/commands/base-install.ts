/**
 * Base Install Command
 * Installs Agent OS from GitHub repository to ~/agent-os
 */

import { Command } from 'commander';
import { existsSync, rmSync, cpSync, chmodSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
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
} from '../utils/output.js';
import { getYamlValue } from '../utils/yaml.js';
import { ensureDir, writeFile } from '../utils/filesystem.js';
import type { BaseInstallOptions, UpdateChoice } from '../types/index.js';

// Repository configuration
const REPO_URL = 'https://github.com/srcmayte/agent-os';
const BASE_DIR = join(homedir(), 'agent-os');

// Files to exclude from installation
const EXCLUSIONS = ['scripts/base-install.sh', 'old-versions/*', '.git*', '.github/*'];

/**
 * Create base-install command
 */
export function createBaseInstallCommand(): Command {
  const command = new Command('base-install')
    .aliases(['init', 'setup'])
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
 * Get latest version from GitHub
 */
async function getLatestVersion(): Promise<string> {
  try {
    const configUrl = `${REPO_URL}/raw/main/config.yml`;
    const response = await fetch(configUrl);
    if (!response.ok) return '';

    const content = await response.text();
    const match = content.match(/^version:\s*(.+)$/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

/**
 * Prompt for overwrite choice
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

  const { choice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'choice',
      message: 'Select an option:',
      choices: [
        {
          name: '1) Full update - Updates profiles/default/*, scripts/*, CHANGELOG.md, and version',
          value: 1,
        },
        {
          name: '2) Update default profile only - Updates profiles/default/*',
          value: 2,
        },
        {
          name: '3) Update scripts only - Updates scripts/*',
          value: 3,
        },
        {
          name: '4) Update config.yml only - Updates config.yml',
          value: 4,
        },
        {
          name: '5) Delete & reinstall fresh - Backs up and reinstalls everything',
          value: 5,
        },
        {
          name: '6) Cancel and abort',
          value: 6,
        },
      ],
    },
  ]);

  switch (choice as UpdateChoice) {
    case 1:
      console.log('');
      printStatus('Performing full update...');
      await createBackup();
      await fullUpdate(latestVersion);
      break;
    case 2:
      console.log('');
      printStatus('Updating default profile...');
      await createBackup();
      await overwriteProfile();
      break;
    case 3:
      console.log('');
      printStatus('Updating scripts...');
      await createBackup();
      await overwriteScripts();
      break;
    case 4:
      console.log('');
      printStatus('Updating config.yml...');
      await createBackup();
      await overwriteConfig();
      break;
    case 5:
      console.log('');
      printStatus('Deleting & reinstalling fresh...');
      await overwriteAll();
      break;
    case 6:
      console.log('');
      printWarning('Installation cancelled');
      return;
  }
}

/**
 * Create backup of existing installation
 */
async function createBackup(): Promise<void> {
  const backupDir = `${BASE_DIR}.backup`;
  if (existsSync(backupDir)) {
    rmSync(backupDir, { recursive: true, force: true });
  }
  cpSync(BASE_DIR, backupDir, { recursive: true });
  printSuccess('Backed up existing installation to ~/agent-os.backup');
  console.log('');
}

/**
 * Full update
 */
async function fullUpdate(latestVersion: string): Promise<void> {
  // Update default profile
  printStatus('Updating default profile...');
  rmSync(join(BASE_DIR, 'profiles', 'default'), { recursive: true, force: true });
  const profileFiles = await downloadFilesFromGitHub('profiles/default');
  printSuccess(`Updated default profile (${profileFiles.length} files)`);
  console.log('');

  // Update scripts
  printStatus('Updating scripts...');
  rmSync(join(BASE_DIR, 'scripts'), { recursive: true, force: true });
  const scriptFiles = await downloadFilesFromGitHub('scripts');
  makeExecutable(join(BASE_DIR, 'scripts'));
  printSuccess(`Updated scripts (${scriptFiles.length} files)`);
  console.log('');

  // Update CHANGELOG.md
  printStatus('Updating CHANGELOG.md...');
  await downloadFile('CHANGELOG.md', join(BASE_DIR, 'CHANGELOG.md'));
  printSuccess('Updated CHANGELOG.md');
  console.log('');

  // Update version in config.yml
  if (latestVersion) {
    printStatus('Updating version number in config.yml...');
    const configPath = join(BASE_DIR, 'config.yml');
    if (existsSync(configPath)) {
      const { readFileSync, writeFileSync } = await import('fs');
      let content = readFileSync(configPath, 'utf-8');
      content = content.replace(/^version:.*/m, `version: ${latestVersion}`);
      writeFileSync(configPath, content);
      printSuccess(`Updated version to ${latestVersion} in config.yml`);
    }
  }
  console.log('');

  printSuccess('Full update completed!');
}

/**
 * Overwrite default profile only
 */
async function overwriteProfile(): Promise<void> {
  rmSync(join(BASE_DIR, 'profiles', 'default'), { recursive: true, force: true });
  const files = await downloadFilesFromGitHub('profiles/default');
  printSuccess(`Updated default profile (${files.length} files)`);
  console.log('');
  printSuccess('Default profile has been updated!');
}

/**
 * Overwrite scripts only
 */
async function overwriteScripts(): Promise<void> {
  rmSync(join(BASE_DIR, 'scripts'), { recursive: true, force: true });
  const files = await downloadFilesFromGitHub('scripts');
  makeExecutable(join(BASE_DIR, 'scripts'));
  printSuccess(`Updated scripts (${files.length} files)`);
  console.log('');
  printSuccess('Scripts have been updated!');
}

/**
 * Overwrite config only
 */
async function overwriteConfig(): Promise<void> {
  await downloadFile('config.yml', join(BASE_DIR, 'config.yml'));
  printSuccess('Updated config.yml');
  console.log('');
  printSuccess('Config has been updated!');
}

/**
 * Delete everything and reinstall fresh
 */
async function overwriteAll(): Promise<void> {
  const backupDir = `${BASE_DIR}.backup`;
  if (existsSync(backupDir)) {
    rmSync(backupDir, { recursive: true, force: true });
  }
  cpSync(BASE_DIR, backupDir, { recursive: true });
  printSuccess('Backed up existing installation to ~/agent-os.backup');
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

  // Make scripts executable
  makeExecutable(join(BASE_DIR, 'scripts'));

  console.log('');
  printSuccess('Agent OS has been successfully installed!');
  console.log('');
  console.log(`${Colors.GREEN}Next steps:${Colors.RESET}`);
  console.log('');
  console.log(`${Colors.GREEN}1) Customize your profile's standards in ~/agent-os/profiles/default/standards${Colors.RESET}`);
  console.log('');
  console.log(`${Colors.GREEN}2) Navigate to a project directory${Colors.RESET}`);
  console.log(`   ${Colors.YELLOW}cd path/to/project-directory${Colors.RESET}`);
  console.log('');
  console.log(`${Colors.GREEN}3) Install Agent OS in your project by running:${Colors.RESET}`);
  console.log(`   ${Colors.YELLOW}agent-os install${Colors.RESET}`);
  console.log('');
  console.log(`${Colors.GREEN}Visit the docs for guides on how to use Agent OS: https://buildermethods.com/agent-os${Colors.RESET}`);
  console.log('');
}

/**
 * Check if file should be excluded
 */
function shouldExclude(filePath: string): boolean {
  for (const pattern of EXCLUSIONS) {
    if (pattern.includes('*')) {
      const prefix = pattern.replace(/\*/g, '');
      if (filePath.startsWith(prefix)) return true;
    } else if (filePath === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Get all files from GitHub repo using the tree API
 */
async function getRepoFiles(): Promise<string[]> {
  const treeUrl = `https://api.github.com/repos/buildermethods/agent-os/git/trees/main?recursive=true`;

  const response = await fetch(treeUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch repository file list');
  }

  const data = (await response.json()) as { tree: Array<{ path: string; type: string }> };
  const files: string[] = [];

  for (const item of data.tree) {
    if (item.type === 'blob' && !shouldExclude(item.path)) {
      files.push(item.path);
    }
  }

  return files;
}

/**
 * Download a file from GitHub
 */
async function downloadFile(relativePath: string, destPath: string): Promise<boolean> {
  const fileUrl = `${REPO_URL}/raw/main/${relativePath}`;

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return false;

    const content = await response.text();
    ensureDir(dirname(destPath));
    writeFile(content, destPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download files from GitHub matching a prefix
 */
async function downloadFilesFromGitHub(prefix: string): Promise<string[]> {
  const allFiles = await getRepoFiles();
  const matchingFiles = allFiles.filter((f) => f.startsWith(prefix));
  const downloaded: string[] = [];

  for (const file of matchingFiles) {
    const destPath = join(BASE_DIR, file);
    if (await downloadFile(file, destPath)) {
      downloaded.push(file);
    }
  }

  return downloaded;
}

/**
 * Download all files from repository
 */
async function downloadAllFiles(): Promise<number> {
  const allFiles = await getRepoFiles();
  let count = 0;

  for (const file of allFiles) {
    const destPath = join(BASE_DIR, file);
    if (await downloadFile(file, destPath)) {
      count++;
    }
  }

  return count;
}

/**
 * Make scripts executable
 */
function makeExecutable(dir: string): void {
  if (!existsSync(dir)) return;

  const files = readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.sh')) {
      const fullPath = join(dir, file);
      if (statSync(fullPath).isFile()) {
        chmodSync(fullPath, 0o755);
      }
    }
  }
}

export { runBaseInstall };
