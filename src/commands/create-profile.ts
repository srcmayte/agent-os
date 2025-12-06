/**
 * Create Profile Command
 * Creates a new profile for Agent OS
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync, cpSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import {
  printStatus,
  printSuccess,
  printError,
  printWarning,
  Colors,
} from '../utils/output.js';
import { normalizeName } from '../utils/filesystem.js';
import { getBaseDir, requireBaseInstallation, requireDirectory } from '../lib/config.js';
import { getAvailableProfiles } from '../lib/profile.js';
import type { CreateProfileOptions } from '../types/index.js';

/**
 * Create create-profile command
 */
export function createCreateProfileCommand(): Command {
  const command = new Command('create-profile')
    .aliases(['profile', 'new-profile'])
    .description('Create a new Agent OS profile')
    .option('-n, --name <name>', 'Profile name')
    .option('-i, --inherits-from <profile>', 'Inherit from existing profile')
    .option('-c, --copy-from <profile>', 'Copy from existing profile')
    .action(async (options: CreateProfileOptions) => {
      await runCreateProfile(options);
    });

  return command;
}

/**
 * Run create profile
 */
async function runCreateProfile(options: CreateProfileOptions): Promise<void> {
  console.clear();
  console.log('');
  console.log(`${Colors.BLUE}=== Agent OS - Create Profile Utility ===${Colors.RESET}`);
  console.log('');

  const baseDir = getBaseDir();
  const profilesDir = join(baseDir, 'profiles');

  // Validate installation using shared functions
  requireBaseInstallation(baseDir);
  requireDirectory(profilesDir, `Profiles directory not found at ${profilesDir}`);

  // Get profile name
  let profileName = options.name;
  if (!profileName) {
    profileName = await promptProfileName(profilesDir);
  } else {
    profileName = normalizeName(profileName);
    if (existsSync(join(profilesDir, profileName))) {
      printError(`Profile '${profileName}' already exists`);
      process.exit(1);
    }
  }

  // Get inheritance or copy settings
  let inheritsFrom = options.inheritsFrom;
  let copyFrom = options.copyFrom;

  if (!inheritsFrom && !copyFrom) {
    const result = await promptInheritanceChoice(profilesDir);
    inheritsFrom = result.inheritsFrom;
    copyFrom = result.copyFrom;
  }

  // Create the profile
  await createProfile(profilesDir, profileName, inheritsFrom, copyFrom);

  // Success message
  console.log('');
  console.log(`${Colors.GREEN}════════════════════════════════════════════${Colors.RESET}`);
  console.log('');
  printSuccess(`Profile '${profileName}' has been successfully created!`);
  console.log('');
  printStatus(`Location: ${profilesDir}/${profileName}`);

  if (inheritsFrom) {
    console.log('');
    printStatus(`This profile inherits from: ${inheritsFrom}`);
  } else if (copyFrom) {
    console.log('');
    printStatus(`This profile was copied from: ${copyFrom}`);
  }

  console.log('');
  printStatus('Next steps:');
  console.log('  1. Customize standards, workflows, and configurations in your profile');
  console.log(`  2. Install Agent OS in a project using this profile with: agent-os install --profile ${profileName}`);
  console.log('');
  console.log(`${Colors.GREEN}Visit the docs on customizing your profile: https://buildermethods.com/agent-os/profiles${Colors.RESET}`);
  console.log('');
  console.log(`${Colors.GREEN}════════════════════════════════════════════${Colors.RESET}`);
  console.log('');
}

/**
 * Prompt for profile name
 */
async function promptProfileName(profilesDir: string): Promise<string> {
  let valid = false;
  let profileName = '';

  while (!valid) {
    console.log('');
    console.log('');
    console.log('');
    printStatus('Enter a name for the new profile:');
    console.log("Example names: 'project-1', 'project-2' (use your domain, company, or project name)");
    console.log('');

    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Profile name:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Profile name cannot be empty';
          }
          return true;
        },
      },
    ]);

    profileName = normalizeName(name);

    if (!profileName) {
      printError('Profile name cannot be empty');
      continue;
    }

    if (existsSync(join(profilesDir, profileName))) {
      printError(`Profile '${profileName}' already exists`);
      console.log('Please choose a different name');
      continue;
    }

    valid = true;
    printSuccess(`Profile name set to: ${profileName}`);
  }

  return profileName;
}

/**
 * Prompt for inheritance/copy choice
 */
async function promptInheritanceChoice(
  profilesDir: string
): Promise<{ inheritsFrom?: string; copyFrom?: string }> {
  const profiles = getAvailableProfiles(join(profilesDir, '..'));

  if (profiles.length === 0) {
    printWarning('No existing profiles found');
    return {};
  }

  console.log('');
  console.log('');
  console.log('');

  if (profiles.length === 1) {
    // Only one profile exists
    printStatus(`Should this profile inherit from the '${profiles[0]}' profile?`);
    console.log('');

    const { inherit } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'inherit',
        message: `Inherit from '${profiles[0]}'?`,
        default: true,
      },
    ]);

    if (inherit) {
      printSuccess(`Profile will inherit from: ${profiles[0]}`);
      return { inheritsFrom: profiles[0] };
    }

    // If not inheriting, ask about copying
    console.log('');
    console.log('');
    console.log('');
    printStatus(`Do you want to copy the contents from the '${profiles[0]}' profile?`);
    console.log('');

    const { copy } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'copy',
        message: `Copy from '${profiles[0]}'?`,
        default: false,
      },
    ]);

    if (copy) {
      printSuccess(`Will copy contents from: ${profiles[0]}`);
      return { copyFrom: profiles[0] };
    }

    printStatus('Will create empty profile structure');
    return {};
  }

  // Multiple profiles exist
  printStatus('Select a profile to inherit from:');
  console.log('');

  const choices = [
    { name: "Don't inherit from any profile", value: null },
    ...profiles.map((p) => ({ name: p, value: p })),
  ];

  const { selection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selection',
      message: 'Select profile:',
      choices,
    },
  ]);

  if (selection) {
    printSuccess(`Profile will inherit from: ${selection}`);
    return { inheritsFrom: selection };
  }

  // If not inheriting, ask about copying
  console.log('');
  console.log('');
  console.log('');
  printStatus('Select a profile to copy from:');
  console.log('');

  const copyChoices = [
    { name: "Don't copy from any profile", value: null },
    ...profiles.map((p) => ({ name: p, value: p })),
  ];

  const { copySelection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'copySelection',
      message: 'Select profile:',
      choices: copyChoices,
    },
  ]);

  if (copySelection) {
    printSuccess(`Will copy contents from: ${copySelection}`);
    return { copyFrom: copySelection };
  }

  printStatus('Will create empty profile structure');
  return {};
}

/**
 * Create the profile directory and files
 */
async function createProfile(
  profilesDir: string,
  profileName: string,
  inheritsFrom?: string,
  copyFrom?: string
): Promise<void> {
  const profilePath = join(profilesDir, profileName);

  printStatus('Creating profile structure...');

  if (copyFrom) {
    // Copy from existing profile
    printStatus(`Copying from profile: ${copyFrom}`);
    cpSync(join(profilesDir, copyFrom), profilePath, { recursive: true });

    // Update profile-config.yml
    writeFileSync(
      join(profilePath, 'profile-config.yml'),
      `inherits_from: false

# Profile configuration for ${profileName}
# Copied from: ${copyFrom}
`
    );

    printSuccess('Profile copied and configured');
  } else {
    // Create new structure
    mkdirSync(profilePath, { recursive: true });
    mkdirSync(join(profilePath, 'standards'), { recursive: true });
    mkdirSync(join(profilePath, 'workflows', 'implementation'), { recursive: true });
    mkdirSync(join(profilePath, 'workflows', 'planning'), { recursive: true });
    mkdirSync(join(profilePath, 'workflows', 'specification'), { recursive: true });

    // Create profile-config.yml
    if (inheritsFrom) {
      writeFileSync(
        join(profilePath, 'profile-config.yml'),
        `inherits_from: ${inheritsFrom}

# Uncomment and modify to exclude specific inherited files:
# exclude_inherited_files:
#   - standards/backend/api/*
#   - standards/backend/database/migrations.md
#   - workflows/implementation/specific-workflow.md
`
      );
    } else {
      writeFileSync(
        join(profilePath, 'profile-config.yml'),
        `inherits_from: false

# Profile configuration for ${profileName}
`
      );
    }

    printSuccess('Profile structure created');
  }
}
