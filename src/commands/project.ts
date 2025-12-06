/**
 * Project Command Group
 * Groups project-related commands: setup and sync
 */

import { Command } from 'commander';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import {
  loadBaseConfig,
  loadProjectConfig,
  validateConfig,
  getEffectiveConfig,
  writeProjectConfig,
  isAgentOsInstalled,
  getBaseDir,
  requireBaseInstallation,
  requireProjectInstallation,
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
import type { ProjectInstallOptions, ProjectUpdateOptions } from '../types/index.js';

/**
 * Parse boolean option
 */
function parseBool(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value.toLowerCase() === 'true';
}

/**
 * Create the project command group with setup and sync subcommands
 */
export function createProjectCommand(): Command {
  const project = new Command('project')
    .description('Project-related commands for Agent OS');

  // Setup subcommand (was project-install)
  project
    .command('setup')
    .aliases(['install', 'init'])
    .description('Set up Agent OS in the current project directory')
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
      await runProjectSetup(options);
    });

  // Sync subcommand (was project-update)
  project
    .command('sync')
    .aliases(['update', 'refresh'])
    .description('Sync/update Agent OS installation in the current project')
    .option('--profile <profile>', 'Use specified profile')
    .option('--claude-code-commands [bool]', 'Install Claude Code commands', parseBool)
    .option('--use-claude-code-subagents [bool]', 'Use Claude Code subagents', parseBool)
    .option('--agent-os-commands [bool]', 'Install agent-os commands', parseBool)
    .option('--standards-as-claude-code-skills [bool]', 'Use Claude Code Skills for standards', parseBool)
    .option('--overwrite-all', 'Overwrite all existing files')
    .option('--overwrite-standards', 'Overwrite existing standards')
    .option('--overwrite-commands', 'Overwrite existing commands')
    .option('--overwrite-agents', 'Overwrite existing agents')
    .option('--dry-run', 'Show what would be done without doing it')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (options: ProjectUpdateOptions) => {
      await runProjectSync(options);
    });

  return project;
}

/**
 * Run project setup (was runProjectInstall)
 */
async function runProjectSetup(options: ProjectInstallOptions): Promise<void> {
  printSection('Agent OS Project Setup');

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
    console.log('  agent-os project setup\n');
    process.exit(1);
  }

  // Validate base installation using shared function
  requireBaseInstallation(baseDir);

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

  // Check for existing installation
  if (isAgentOsInstalled(projectDir)) {
    if (options.reInstall) {
      await handleReinstallation(projectDir, baseDir, effectiveConfig, options);
      return;
    }

    // Prompt for what to do
    console.log('');
    printWarning('Agent OS is already installed in this project');
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Update/sync existing installation', value: 'update' },
          { name: 'Reinstall from scratch', value: 'reinstall' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ]);

    if (action === 'cancel') {
      printWarning('Installation cancelled');
      return;
    }

    if (action === 'reinstall') {
      await handleReinstallation(projectDir, baseDir, effectiveConfig, options);
      return;
    }

    // Fall through to update
    await performProjectSync(projectDir, baseDir, effectiveConfig, options);
    return;
  }

  // Perform fresh installation
  await performFreshProjectInstallation(projectDir, baseDir, effectiveConfig, options);
}

/**
 * Run project sync (was runProjectUpdate)
 */
async function runProjectSync(options: ProjectUpdateOptions): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  const projectDir = process.cwd();
  const baseDir = getBaseDir();

  // Validate installations using shared functions
  requireBaseInstallation(baseDir);
  requireProjectInstallation(projectDir);

  // Load configurations
  const baseConfig = loadBaseConfig(baseDir);
  const projectConfig = loadProjectConfig(projectDir);

  // Get effective configuration
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

  // Check for version/config differences
  await checkAndPromptForChanges(baseConfig, projectConfig, effectiveConfig);

  // Perform the sync
  await performProjectSync(projectDir, baseDir, effectiveConfig, options);
}

/**
 * Check if this is the base installation directory
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
    printWarning('This will also delete .claude/agents/agent-os/ and .claude/commands/agent-os/');
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
    printWarning('Re-installation cancelled');
    return;
  }

  // Delete existing installations
  const agentOsDir = join(projectDir, 'agent-os');
  if (existsSync(agentOsDir)) {
    rmSync(agentOsDir, { recursive: true, force: true });
    printSuccess('Deleted agent-os/');
  }

  if (existsSync(claudeAgentsDir)) {
    rmSync(claudeAgentsDir, { recursive: true, force: true });
    printSuccess('Deleted .claude/agents/agent-os/');
  }

  if (existsSync(claudeCommandsDir)) {
    rmSync(claudeCommandsDir, { recursive: true, force: true });
    printSuccess('Deleted .claude/commands/agent-os/');
  }

  console.log('');

  // Perform fresh installation
  await performFreshProjectInstallation(projectDir, baseDir, effectiveConfig, options);
}

/**
 * Perform fresh project installation
 */
async function performFreshProjectInstallation(
  projectDir: string,
  baseDir: string,
  effectiveConfig: ReturnType<typeof getEffectiveConfig>,
  options: ProjectInstallOptions
): Promise<void> {
  printSection('Installing Agent OS');

  const dryRun = options.dryRun || false;

  if (dryRun) {
    printWarning('DRY RUN MODE - No changes will be made');
    console.log('');
  }

  // Display configuration
  printStatus('Configuration:');
  console.log(`  Profile: ${Colors.YELLOW}${effectiveConfig.profile}${Colors.RESET}`);
  console.log(`  Claude Code Commands: ${Colors.YELLOW}${effectiveConfig.claude_code_commands}${Colors.RESET}`);
  console.log(`  Subagents: ${Colors.YELLOW}${effectiveConfig.use_claude_code_subagents}${Colors.RESET}`);
  console.log(`  Agent OS Commands: ${Colors.YELLOW}${effectiveConfig.agent_os_commands}${Colors.RESET}`);
  console.log('');

  // Create agent-os directory
  const agentOsDir = join(projectDir, 'agent-os');
  if (!dryRun) {
    mkdirSync(agentOsDir, { recursive: true });
  }
  printSuccess('Created agent-os/ directory');
  console.log('');

  // Install components
  const standardsResult = installStandards(projectDir, baseDir, effectiveConfig, dryRun);
  printSuccess(`Installed ${standardsResult.files.length} standards`);

  if (effectiveConfig.claude_code_commands) {
    const commandsResult = installClaudeCodeCommands(projectDir, baseDir, effectiveConfig, dryRun);
    printSuccess(`Installed ${commandsResult.files.length} Claude Code commands`);

    const agentsResult = installClaudeCodeAgents(projectDir, baseDir, effectiveConfig, dryRun);
    printSuccess(`Installed ${agentsResult.files.length} Claude Code agents`);
  }

  if (effectiveConfig.agent_os_commands) {
    const osCommandsResult = installAgentOsCommands(projectDir, baseDir, effectiveConfig, dryRun);
    printSuccess(`Installed ${osCommandsResult.files.length} agent-os commands`);
  }

  // Write project config
  writeProjectConfig(projectDir, effectiveConfig, dryRun);
  printSuccess('Created project configuration');

  console.log('');
  printSuccess('Agent OS has been installed in your project!');
  console.log('');
  console.log(`${Colors.GREEN}Next steps:${Colors.RESET}`);
  console.log('');
  console.log(`${Colors.GREEN}1) Review your standards in ./agent-os/standards/${Colors.RESET}`);
  console.log('');
  console.log(`${Colors.GREEN}2) Start using Agent OS with your AI coding tools${Colors.RESET}`);
  console.log('');
}

/**
 * Perform project sync/update
 */
async function performProjectSync(
  projectDir: string,
  baseDir: string,
  effectiveConfig: ReturnType<typeof getEffectiveConfig>,
  options: ProjectUpdateOptions | ProjectInstallOptions
): Promise<void> {
  printSection('Syncing Agent OS');

  const dryRun = 'dryRun' in options ? options.dryRun || false : false;

  if (dryRun) {
    printWarning('DRY RUN MODE - No changes will be made');
    console.log('');
  }

  // Display configuration
  printStatus('Configuration:');
  console.log(`  Profile: ${Colors.YELLOW}${effectiveConfig.profile}${Colors.RESET}`);
  console.log(`  Claude Code Commands: ${Colors.YELLOW}${effectiveConfig.claude_code_commands}${Colors.RESET}`);
  console.log(`  Subagents: ${Colors.YELLOW}${effectiveConfig.use_claude_code_subagents}${Colors.RESET}`);
  console.log(`  Agent OS Commands: ${Colors.YELLOW}${effectiveConfig.agent_os_commands}${Colors.RESET}`);
  console.log('');

  // Determine what to overwrite
  const overwriteAll = 'overwriteAll' in options && options.overwriteAll;
  const overwriteStandards = overwriteAll || ('overwriteStandards' in options && options.overwriteStandards);
  const overwriteCommands = overwriteAll || ('overwriteCommands' in options && options.overwriteCommands);
  const overwriteAgents = overwriteAll || ('overwriteAgents' in options && options.overwriteAgents);

  // Sync standards
  if (overwriteStandards) {
    const standardsDir = join(projectDir, 'agent-os', 'standards');
    if (existsSync(standardsDir) && !dryRun) {
      rmSync(standardsDir, { recursive: true, force: true });
    }
  }
  const standardsResult = installStandards(projectDir, baseDir, effectiveConfig, dryRun);
  printSuccess(`Synced ${standardsResult.files.length} standards`);

  // Sync Claude Code commands
  if (effectiveConfig.claude_code_commands) {
    if (overwriteCommands) {
      const commandsDir = join(projectDir, '.claude', 'commands', 'agent-os');
      if (existsSync(commandsDir) && !dryRun) {
        rmSync(commandsDir, { recursive: true, force: true });
      }
    }
    const commandsResult = installClaudeCodeCommands(projectDir, baseDir, effectiveConfig, dryRun);
    printSuccess(`Synced ${commandsResult.files.length} Claude Code commands`);

    if (overwriteAgents) {
      const agentsDir = join(projectDir, '.claude', 'agents', 'agent-os');
      if (existsSync(agentsDir) && !dryRun) {
        rmSync(agentsDir, { recursive: true, force: true });
      }
    }
    const agentsResult = installClaudeCodeAgents(projectDir, baseDir, effectiveConfig, dryRun);
    printSuccess(`Synced ${agentsResult.files.length} Claude Code agents`);
  }

  // Sync agent-os commands
  if (effectiveConfig.agent_os_commands) {
    const osCommandsResult = installAgentOsCommands(projectDir, baseDir, effectiveConfig, dryRun);
    printSuccess(`Synced ${osCommandsResult.files.length} agent-os commands`);
  }

  // Update project config
  writeProjectConfig(projectDir, effectiveConfig, dryRun);
  printSuccess('Updated project configuration');

  console.log('');
  printSuccess('Agent OS has been synced!');
  console.log('');
}

/**
 * Check for config/version changes and prompt user
 */
async function checkAndPromptForChanges(
  baseConfig: ReturnType<typeof loadBaseConfig>,
  projectConfig: ReturnType<typeof loadProjectConfig>,
  effectiveConfig: ReturnType<typeof getEffectiveConfig>
): Promise<void> {
  if (!projectConfig) return;

  const changes: string[] = [];

  if (projectConfig.profile !== effectiveConfig.profile) {
    changes.push(`Profile: ${projectConfig.profile} → ${effectiveConfig.profile}`);
  }

  if (projectConfig.claude_code_commands !== effectiveConfig.claude_code_commands) {
    changes.push(`Claude Code Commands: ${projectConfig.claude_code_commands} → ${effectiveConfig.claude_code_commands}`);
  }

  if (projectConfig.use_claude_code_subagents !== effectiveConfig.use_claude_code_subagents) {
    changes.push(`Subagents: ${projectConfig.use_claude_code_subagents} → ${effectiveConfig.use_claude_code_subagents}`);
  }

  if (changes.length > 0) {
    console.log('');
    printStatus('Configuration changes detected:');
    for (const change of changes) {
      console.log(`  ${change}`);
    }
    console.log('');
  }
}
