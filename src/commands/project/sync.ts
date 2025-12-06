/**
 * Project Sync Command
 * Syncs/updates Agent OS installation in the current project
 */

import { Command } from 'commander';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import {
  loadBaseConfig,
  loadProjectConfig,
  getEffectiveConfig,
  writeProjectConfig,
  getBaseDir,
  requireBaseInstallation,
  requireProjectInstallation,
} from '../../lib/config.js';
import {
  installStandards,
  installClaudeCodeCommands,
  installClaudeCodeAgents,
  installAgentOsCommands,
} from '../../lib/installer.js';
import {
  printSection,
  printStatus,
  printSuccess,
  printWarning,
  setVerbose,
  printCompletion,
  parseBool,
} from '../../utils/output.js';
import type { ProjectUpdateOptions, ProjectInstallOptions } from '../../types/index.js';
import { displayConfiguration } from './shared.js';

/**
 * Create the project sync command
 */
export function createProjectSyncCommand(): Command {
  return new Command('sync')
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
}

/**
 * Run project sync
 */
async function runProjectSync(options: ProjectUpdateOptions): Promise<void> {
  if (options.verbose) {
    setVerbose(true);
  }

  const projectDir = process.cwd();
  const baseDir = getBaseDir();

  // Validate installations
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
 * Perform project sync/update
 */
export async function performProjectSync(
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
  displayConfiguration(effectiveConfig);

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

  printCompletion('Agent OS has been synced!', []);
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
