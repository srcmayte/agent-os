/**
 * Project Update Command
 * Updates Agent OS installation in a project
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
  needsMigration,
} from '../lib/config.js';
import {
  installStandards,
  installClaudeCodeCommands,
  installClaudeCodeAgents,
  installAgentOsCommands,
} from '../lib/installer.js';
import { getProfileFiles } from '../lib/profile.js';
import {
  printStatus,
  printSuccess,
  printError,
  printWarning,
  setVerbose,
  Colors,
} from '../utils/output.js';
import type { ProjectUpdateOptions, EffectiveConfig } from '../types/index.js';

/**
 * Create project-update command
 */
export function createProjectUpdateCommand(): Command {
  const command = new Command('project-update')
    .aliases(['update', 'u'])
    .description('Update Agent OS installation in the current project')
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
      await runProjectUpdate(options);
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
 * Run project update
 */
async function runProjectUpdate(options: ProjectUpdateOptions): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  const projectDir = process.cwd();
  const baseDir = getBaseDir();

  // Validate base installation
  if (!existsSync(join(baseDir, 'config.yml'))) {
    printError('Agent OS base installation not found at ~/agent-os/');
    console.log('\nPlease run the base installation first:\n');
    console.log('  agent-os base-install\n');
    process.exit(1);
  }

  // Check project installation
  if (!isAgentOsInstalled(projectDir)) {
    printError('Agent OS not installed in this project');
    console.log('\nPlease run project-install.sh first:\n');
    console.log('  agent-os install\n');
    process.exit(1);
  }

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
  const hasVersionDiff =
    projectConfig?.version !== baseConfig?.version ||
    needsMigration(projectConfig?.version || '');

  const hasConfigDiff =
    projectConfig?.profile !== effectiveConfig.profile ||
    projectConfig?.claude_code_commands !== effectiveConfig.claude_code_commands ||
    projectConfig?.use_claude_code_subagents !== effectiveConfig.use_claude_code_subagents ||
    projectConfig?.agent_os_commands !== effectiveConfig.agent_os_commands ||
    projectConfig?.standards_as_claude_code_skills !== effectiveConfig.standards_as_claude_code_skills;

  // Prompt for confirmation
  const confirmed = await promptUpdateConfirmation(
    projectConfig?.version || '',
    hasVersionDiff,
    hasConfigDiff,
    effectiveConfig,
    projectConfig,
    options.dryRun || false
  );

  if (!confirmed) {
    printStatus('Update cancelled by user');
    return;
  }

  // Validate configuration
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
  console.log('');

  // Perform cleanup and update
  await performUpdateCleanup(projectDir, baseDir, effectiveConfig, options.dryRun || false);

  // Perform update
  await performUpdate(projectDir, baseDir, effectiveConfig, options);
}

/**
 * Prompt for update confirmation
 */
async function promptUpdateConfirmation(
  currentVersion: string,
  hasVersionDiff: boolean,
  hasConfigDiff: boolean,
  effectiveConfig: EffectiveConfig,
  projectConfig: ReturnType<typeof loadProjectConfig>,
  dryRun: boolean
): Promise<boolean> {
  if (hasVersionDiff || hasConfigDiff) {
    console.log('');
    console.log(`${Colors.PURPLE}=== Version/Configuration Update Required ===${Colors.RESET}`);
    console.log('');
    if (dryRun) {
      printWarning('Dry run simulation');
    }
    console.log('');
    printStatus("Your project's Agent OS version and/or configuration is different than the version you're trying to install.");
  } else {
    console.log('');
    console.log(`${Colors.PURPLE}=== Confirm Update ===${Colors.RESET}`);
    console.log('');
    if (dryRun) {
      printWarning('Dry run simulation');
    }
    console.log('');
    if (dryRun) {
      printStatus("Confirm you'd like to proceed with a DRY RUN update simulation.");
    } else {
      printStatus("Confirm you'd like to proceed with an update.");
    }
  }
  console.log('');

  // Display current project config
  printStatus("Current project's Agent OS:");
  if (currentVersion) {
    console.log(`  Version: ${currentVersion}`);
  } else {
    console.log('  Version: (not specified)');
  }

  if (projectConfig) {
    console.log(`  Profile: ${projectConfig.profile || 'default'}`);
    console.log(`  Claude Code commands: ${projectConfig.claude_code_commands || false}`);
    console.log(`  Use Claude Code subagents: ${projectConfig.use_claude_code_subagents || false}`);
    console.log(`  Agent OS commands: ${projectConfig.agent_os_commands || false}`);
    console.log(`  Standards as Claude Code Skills: ${projectConfig.standards_as_claude_code_skills || false}`);
  }
  console.log('');

  // Display incoming config
  printStatus('Incoming Agent OS:');
  console.log(`  Version: ${effectiveConfig.version}`);
  console.log(`  Profile: ${effectiveConfig.profile}`);
  console.log(`  Claude Code commands: ${effectiveConfig.claude_code_commands}`);
  console.log(`  Use Claude Code subagents: ${effectiveConfig.use_claude_code_subagents}`);
  console.log(`  Agent OS commands: ${effectiveConfig.agent_os_commands}`);
  console.log(`  Standards as Claude Code Skills: ${effectiveConfig.standards_as_claude_code_skills}`);
  console.log('');

  // Show what will happen
  if (dryRun) {
    printStatus("Here's what WOULD happen if this were a real update (but it's a DRY RUN):");
  } else {
    printStatus("Here's what will happen if you proceed:");
  }
  console.log('');
  console.log(`${Colors.GREEN}✔ These will remain intact:${Colors.RESET}`);
  console.log('');
  console.log('  - agent-os/specs/*');
  console.log('  - agent-os/product/*');
  console.log('');

  if (dryRun) {
    console.log(`${Colors.YELLOW}⚠️  These WOULD BE deleted and re-installed if this were a real update:${Colors.RESET}`);
  } else {
    console.log(`${Colors.YELLOW}⚠️  These will be deleted and re-installed:${Colors.RESET}`);
  }
  console.log('');
  console.log('  - agent-os/config.yml');
  console.log('  - agent-os/standards/');
  console.log('  - agent-os/commands/');
  console.log('  - .claude/agents/agent-os/');
  console.log('  - .claude/commands/agent-os/');
  console.log('');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to proceed?',
      default: false,
    },
  ]);

  return confirm;
}

/**
 * Perform cleanup before update
 */
async function performUpdateCleanup(
  projectDir: string,
  baseDir: string,
  config: EffectiveConfig,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    printWarning('Dry run: Would prepare for update...');
    console.log('');
    return;
  }

  printStatus('Preparing for update...');
  console.log('');

  // Delete agent-os/standards/
  const standardsDir = join(projectDir, 'agent-os', 'standards');
  if (existsSync(standardsDir)) {
    printStatus('Removing agent-os/standards/');
    rmSync(standardsDir, { recursive: true, force: true });
  }

  // Delete agent-os/commands/
  const commandsDir = join(projectDir, 'agent-os', 'commands');
  if (existsSync(commandsDir)) {
    printStatus('Removing agent-os/commands/');
    rmSync(commandsDir, { recursive: true, force: true });
  }

  // Delete .claude/agents/agent-os/
  const agentsDir = join(projectDir, '.claude', 'agents', 'agent-os');
  if (existsSync(agentsDir)) {
    printStatus('Removing .claude/agents/agent-os/');
    rmSync(agentsDir, { recursive: true, force: true });
  }

  // Delete .claude/commands/agent-os/
  const claudeCommandsDir = join(projectDir, '.claude', 'commands', 'agent-os');
  if (existsSync(claudeCommandsDir)) {
    printStatus('Removing .claude/commands/agent-os/');
    rmSync(claudeCommandsDir, { recursive: true, force: true });
  }

  // Delete Claude Code skills created by Agent OS
  const skillsDir = join(projectDir, '.claude', 'skills');
  if (existsSync(skillsDir)) {
    // Find skills that match standards files
    const standardsFiles = getProfileFiles(config.profile, baseDir, 'standards');
    for (const file of standardsFiles) {
      if (file.startsWith('standards/') && file.endsWith('.md')) {
        const skillName = file
          .replace(/^standards\//, '')
          .replace(/\.md$/, '')
          .replace(/\//g, '-');
        const skillDir = join(skillsDir, skillName);
        if (existsSync(skillDir)) {
          printStatus(`Removing .claude/skills/${skillName}/`);
          rmSync(skillDir, { recursive: true, force: true });
        }
      }
    }
  }

  console.log('');
  printSuccess('Cleanup complete!');
  console.log('');
  printStatus('Proceeding with update...');
  console.log('');
}

/**
 * Perform the update
 */
async function performUpdate(
  projectDir: string,
  baseDir: string,
  effectiveConfig: EffectiveConfig,
  options: ProjectUpdateOptions
): Promise<void> {
  const dryRun = options.dryRun || false;
  const installedFiles: string[] = [];

  // Display configuration
  console.log('');
  printStatus('Configuration:');
  console.log(`  Profile: ${Colors.YELLOW}${effectiveConfig.profile}${Colors.RESET}`);
  console.log(`  Claude Code commands: ${Colors.YELLOW}${effectiveConfig.claude_code_commands}${Colors.RESET}`);
  console.log(`  Use Claude Code subagents: ${Colors.YELLOW}${effectiveConfig.use_claude_code_subagents}${Colors.RESET}`);
  console.log(`  Standards as Claude Code Skills: ${Colors.YELLOW}${effectiveConfig.standards_as_claude_code_skills}${Colors.RESET}`);
  console.log(`  Agent OS commands: ${Colors.YELLOW}${effectiveConfig.agent_os_commands}${Colors.RESET}`);
  console.log('');

  // Update agent-os folder
  if (!dryRun) {
    printStatus('Updating agent-os folder');
    mkdirSync(join(projectDir, 'agent-os'), { recursive: true });
    writeProjectConfig(projectDir, effectiveConfig);
    printSuccess('Updated agent-os folder');
    printSuccess('Updated agent-os project configuration');
    console.log('');
  }

  // Install standards
  const standardsResult = installStandards(projectDir, baseDir, effectiveConfig, dryRun);
  if (!dryRun && standardsResult.files.length > 0) {
    printSuccess(`Installed ${standardsResult.files.length} standards`);
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

  if (dryRun) {
    printWarning('DRY RUN - No files were actually modified');
    console.log('');
    printStatus('Files that would be created/updated:');
    for (const file of installedFiles) {
      const relativePath = file.replace(projectDir + '/', '');
      console.log(`  - ${relativePath}`);
    }
    console.log('');

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Proceed with actual update?',
        default: true,
      },
    ]);

    if (proceed) {
      await runProjectUpdate({ ...options, dryRun: false });
    }
  } else {
    printSuccess('Agent OS has been successfully updated!');
    console.log('');
    console.log(`${Colors.GREEN}Visit the docs for guides on how to use Agent OS: https://buildermethods.com/agent-os${Colors.RESET}`);
    console.log('');
  }
}

export { runProjectUpdate };
