/**
 * Project Setup Command
 * Sets up Agent OS in the current project directory
 */

import { Command } from 'commander';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import {
  getEffectiveConfig,
  validateConfig,
  writeProjectConfig,
  isAgentOsInstalled,
  getBaseDir,
  requireBaseInstallation,
} from '../../lib/config.js';
import {
  installStandards,
  installClaudeCodeCommands,
  installClaudeCodeAgents,
  installAgentOsCommands,
} from '../../lib/installer.js';
import {
  printSection,
  printSuccess,
  printError,
  printWarning,
  setVerbose,
  printCompletion,
  parseBool,
} from '../../utils/output.js';
import type { ProjectInstallOptions } from '../../types/index.js';
import { checkIsBaseInstallation, displayConfiguration } from './shared.js';
import { performProjectSync } from './sync.js';

/**
 * Create the project setup command
 */
export function createProjectSetupCommand(): Command {
  return new Command('setup')
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
}

/**
 * Run project setup
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

  // Validate base installation
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
  displayConfiguration(effectiveConfig);

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

  printCompletion('Agent OS has been installed in your project!', [
    'Review your standards in ./agent-os/standards/',
    'Start using Agent OS with your AI coding tools',
  ]);
}
