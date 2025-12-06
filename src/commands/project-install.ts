/**
 * Project Install Command
 * Installs Agent OS into a project's codebase
 */

import { Command } from 'commander';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  loadProjectConfig,
  validateConfig,
  getEffectiveConfig,
  writeProjectConfig,
  isAgentOsInstalled,
  getBaseDir,
} from '../lib/config.js';
import {
  installStandards,
  installClaudeCodeCommands,
  installClaudeCodeAgents,
  installAgentOsCommands,
} from '../lib/installer.js';
import {
  printSection,
  printStatus,
  printSuccess,
  printError,
  printWarning,
  setVerbose,
  Colors,
} from '../utils/output.js';
import type { ProjectInstallOptions } from '../types/index.js';
import inquirer from 'inquirer';

/**
 * Create project-install command
 */
export function createProjectInstallCommand(): Command {
  const command = new Command('project-install')
    .aliases(['install', 'i'])
    .description('Install Agent OS into the current project directory')
    .option('--profile <profile>', 'Use specified profile')
    .option('--claude-code-commands [bool]', 'Install Claude Code commands', parseBool)
    .option('--use-claude-code-subagents [bool]', 'Use Claude Code subagents', parseBool)
    .option('--agent-os-commands [bool]', 'Install agent-os commands', parseBool)
    .option('--standards-as-claude-code-skills [bool]', 'Use Claude Code Skills for standards', parseBool)
    .option('--re-install', 'Delete and reinstall Agent OS')
    .option('--overwrite-all', 'Overwrite all existing files')
    .option('--overwrite-standards', 'Overwrite existing standards')
    .option('--overwrite-commands', 'Overwrite existing commands')
    .option('--overwrite-agents', 'Overwrite existing agents')
    .option('--dry-run', 'Show what would be done without doing it')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (options: ProjectInstallOptions) => {
      await runProjectInstall(options);
    });

  return command;
}

/**
 * Parse boolean option
 */
function parseBool(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value.toLowerCase() === 'true';
}

/**
 * Run project installation
 */
async function runProjectInstall(options: ProjectInstallOptions): Promise<void> {
  printSection('Agent OS Project Installation');

  if (options.verbose) {
    setVerbose(true);
  }

  const projectDir = process.cwd();
  const baseDir = getBaseDir();

  // Check if we're in the base installation directory
  if (checkIsBaseInstallation(projectDir)) {
    printError('Cannot install Agent OS in base installation directory');
    console.log('\nIt appears you are in the location of your Agent OS base installation.');
    console.log('To install Agent OS in a project, navigate to your project folder:\n');
    console.log('  cd path/to/project\n');
    console.log('Then run:\n');
    console.log('  agent-os install\n');
    process.exit(1);
  }

  // Validate base installation
  if (!validateBaseInstallation(baseDir)) {
    printError('Agent OS base installation not found at ~/agent-os/');
    console.log('\nPlease run the base installation first:\n');
    console.log('  agent-os base-install\n');
    process.exit(1);
  }

  // Load and validate configuration
  const effectiveConfig = getEffectiveConfig(
    {
      profile: options.profile,
      claudeCodeCommands: options.claudeCodeCommands,
      useClaudeCodeSubagents: options.useClaudeCodeSubagents,
      agentOsCommands: options.agentOsCommands,
      standardsAsClaudeCodeSkills: options.standardsAsClaudeCodeSkills,
    },
    baseDir,
    projectDir
  );

  const validation = validateConfig(effectiveConfig, baseDir);

  if (!validation.valid) {
    for (const error of validation.errors) {
      printError(error);
    }
    process.exit(1);
  }

  for (const warning of validation.warnings) {
    printWarning(warning);
  }

  // Check if Agent OS is already installed
  if (isAgentOsInstalled(projectDir)) {
    if (options.reInstall) {
      await handleReinstallation(projectDir, baseDir, effectiveConfig, options);
      return;
    } else {
      printStatus('Agent OS is already installed. Running update...');
      // Delegate to update logic
      await performUpdate(projectDir, baseDir, effectiveConfig, options);
      return;
    }
  }

  // Perform fresh installation
  await performInstallation(projectDir, baseDir, effectiveConfig, options);
}

/**
 * Check if we're in the base installation directory
 */
function checkIsBaseInstallation(projectDir: string): boolean {
  const configPath = join(projectDir, 'agent-os', 'config.yml');
  if (!existsSync(configPath)) {
    return false;
  }

  const config = loadProjectConfig(projectDir);
  // Check if this looks like the base installation
  return projectDir.endsWith('agent-os') || Boolean(config && 'base_install' in config);
}

/**
 * Validate base installation exists
 */
function validateBaseInstallation(baseDir: string): boolean {
  return existsSync(join(baseDir, 'config.yml'));
}

/**
 * Handle reinstallation
 */
async function handleReinstallation(
  projectDir: string,
  baseDir: string,
  effectiveConfig: ReturnType<typeof getEffectiveConfig>,
  options: ProjectInstallOptions
): Promise<void> {
  printSection('Re-installation');

  printWarning('This will DELETE your current agent-os/ folder and reinstall from scratch.');
  console.log('');

  const claudeAgentsDir = join(projectDir, '.claude', 'agents', 'agent-os');
  const claudeCommandsDir = join(projectDir, '.claude', 'commands', 'agent-os');

  if (existsSync(claudeAgentsDir) || existsSync(claudeCommandsDir)) {
    printWarning('This will also DELETE:');
    if (existsSync(claudeAgentsDir)) console.log('  - .claude/agents/agent-os/');
    if (existsSync(claudeCommandsDir)) console.log('  - .claude/commands/agent-os/');
    console.log('');
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Are you sure you want to proceed?',
      default: false,
    },
  ]);

  if (!confirm) {
    printStatus('Re-installation cancelled');
    return;
  }

  if (!options.dryRun) {
    printStatus('Removing existing installation...');
    rmSync(join(projectDir, 'agent-os'), { recursive: true, force: true });
    rmSync(claudeAgentsDir, { recursive: true, force: true });
    rmSync(claudeCommandsDir, { recursive: true, force: true });
    printSuccess('Existing installation removed');
    console.log('');
  }

  await performInstallation(projectDir, baseDir, effectiveConfig, options);
}

/**
 * Perform fresh installation
 */
async function performInstallation(
  projectDir: string,
  baseDir: string,
  effectiveConfig: ReturnType<typeof getEffectiveConfig>,
  options: ProjectInstallOptions
): Promise<void> {
  const dryRun = options.dryRun || false;
  const installedFiles: string[] = [];

  if (dryRun) {
    printWarning('DRY RUN - No files will be actually created');
    console.log('');
  }

  // Display configuration
  console.log('');
  printStatus('Configuration:');
  console.log(`  Profile: ${Colors.YELLOW}${effectiveConfig.profile}${Colors.RESET}`);
  console.log(`  Claude Code commands: ${Colors.YELLOW}${effectiveConfig.claude_code_commands}${Colors.RESET}`);
  console.log(`  Use Claude Code subagents: ${Colors.YELLOW}${effectiveConfig.use_claude_code_subagents}${Colors.RESET}`);
  console.log(`  Standards as Claude Code Skills: ${Colors.YELLOW}${effectiveConfig.standards_as_claude_code_skills}${Colors.RESET}`);
  console.log(`  Agent OS commands: ${Colors.YELLOW}${effectiveConfig.agent_os_commands}${Colors.RESET}`);
  console.log('');

  // Create agent-os folder
  if (!dryRun) {
    printStatus('Installing agent-os folder');
    mkdirSync(join(projectDir, 'agent-os'), { recursive: true });
    writeProjectConfig(projectDir, effectiveConfig);
    printSuccess('Created agent-os folder');
    printSuccess('Created agent-os project configuration');
    console.log('');
  } else {
    installedFiles.push(join(projectDir, 'agent-os', 'config.yml'));
  }

  // Install standards
  const standardsResult = installStandards(projectDir, baseDir, effectiveConfig, dryRun);
  if (!dryRun && standardsResult.files.length > 0) {
    printSuccess(`Installed ${standardsResult.files.length} standards in agent-os/standards`);
    console.log('');
  }
  installedFiles.push(...standardsResult.files.map((f) => f.path));

  // Install Claude Code files if enabled
  if (effectiveConfig.claude_code_commands) {
    const commandsResult = installClaudeCodeCommands(projectDir, baseDir, effectiveConfig, dryRun);
    if (!dryRun && commandsResult.files.length > 0) {
      printSuccess(`Installed ${commandsResult.files.length} Claude Code commands`);
      console.log('');
    }
    installedFiles.push(...commandsResult.files.map((f) => f.path));

    if (effectiveConfig.use_claude_code_subagents) {
      const agentsResult = installClaudeCodeAgents(projectDir, baseDir, effectiveConfig, dryRun);
      if (!dryRun && agentsResult.files.length > 0) {
        printSuccess(`Installed ${agentsResult.files.length} Claude Code agents`);
        console.log('');
      }
      installedFiles.push(...agentsResult.files.map((f) => f.path));
    }
  }

  // Install agent-os commands if enabled
  if (effectiveConfig.agent_os_commands) {
    const agentOsResult = installAgentOsCommands(projectDir, baseDir, effectiveConfig, dryRun);
    if (!dryRun && agentOsResult.files.length > 0) {
      printSuccess(`Installed ${agentOsResult.files.length} agent-os commands`);
      console.log('');
    }
    installedFiles.push(...agentOsResult.files.map((f) => f.path));
  }

  // Dry run summary
  if (dryRun) {
    console.log('');
    printStatus('The following files would be created:');
    for (const file of installedFiles) {
      const relativePath = file.replace(projectDir + '/', '');
      console.log(`  - ${relativePath}`);
    }

    console.log('');
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with actual installation?',
        default: true,
      },
    ]);

    if (proceed) {
      await performInstallation(projectDir, baseDir, effectiveConfig, {
        ...options,
        dryRun: false,
      });
    }
  } else {
    printSuccess('Agent OS has been successfully installed in your project!');
    console.log('');
    console.log(`${Colors.GREEN}Visit the docs for guides on how to use Agent OS: https://buildermethods.com/agent-os${Colors.RESET}`);
    console.log('');
  }
}

/**
 * Perform update (when already installed)
 */
async function performUpdate(
  projectDir: string,
  baseDir: string,
  effectiveConfig: ReturnType<typeof getEffectiveConfig>,
  options: ProjectInstallOptions
): Promise<void> {
  // For now, just re-run installation with overwrite
  await performInstallation(projectDir, baseDir, effectiveConfig, {
    ...options,
    overwriteAll: true,
  });
}

export { runProjectInstall };
