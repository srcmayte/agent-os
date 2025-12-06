/**
 * Installation utilities for Agent OS CLI
 * Handles installing standards, commands, and agents
 */

import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import type { EffectiveConfig, FileOperationResult, InstallationResult } from '../types/index.js';
import { getProfileFile, getProfileFiles } from './profile.js';
import { compileTemplate, ConditionalContext } from './template.js';
import { copyFile, writeFile as writeFileUtil } from '../utils/filesystem.js';
import { printVerbose, printStatus } from '../utils/output.js';

/**
 * Install standards files from profile to project
 */
export function installStandards(
  projectDir: string,
  baseDir: string,
  config: EffectiveConfig,
  dryRun = false
): InstallationResult {
  const files: FileOperationResult[] = [];
  const errors: string[] = [];

  if (!dryRun) {
    printStatus('Installing standards');
  }

  const standardsFiles = getProfileFiles(config.profile, baseDir, 'standards');

  for (const file of standardsFiles) {
    if (!file.startsWith('standards/')) continue;

    const source = getProfileFile(config.profile, file, baseDir);
    if (!source) continue;

    const dest = join(projectDir, 'agent-os', file);

    try {
      if (!dryRun) {
        copyFile(source, dest);
      }
      files.push({ path: dest, type: 'created' });
    } catch (err) {
      errors.push(`Failed to install ${file}: ${err}`);
    }
  }

  return { success: errors.length === 0, files, errors };
}

/**
 * Install Claude Code commands
 */
export function installClaudeCodeCommands(
  projectDir: string,
  baseDir: string,
  config: EffectiveConfig,
  dryRun = false
): InstallationResult {
  const files: FileOperationResult[] = [];
  const errors: string[] = [];

  if (!dryRun) {
    printStatus(
      config.use_claude_code_subagents
        ? 'Installing Claude Code commands (with delegation to subagents)...'
        : 'Installing Claude Code commands (without delegation)...'
    );
  }

  const targetDir = join(projectDir, '.claude', 'commands', 'agent-os');
  if (!dryRun) {
    mkdirSync(targetDir, { recursive: true });
  }

  const commandFiles = getProfileFiles(config.profile, baseDir, 'commands');
  const context: ConditionalContext = {
    use_claude_code_subagents: config.use_claude_code_subagents,
    standards_as_claude_code_skills: config.standards_as_claude_code_skills,
    compiled_single_command: false,
  };

  for (const file of commandFiles) {
    const isMultiAgent = file.includes('/multi-agent/');
    const isSingleAgent = file.includes('/single-agent/');
    const isOrchestrateTask = file.includes('orchestrate-tasks/orchestrate-tasks.md');

    // Determine if we should process this file based on mode
    let shouldProcess = false;

    if (config.use_claude_code_subagents) {
      // With subagents: use multi-agent files
      shouldProcess = isMultiAgent || isOrchestrateTask;
    } else {
      // Without subagents: use single-agent files (only main command, not numbered)
      if (isSingleAgent || isOrchestrateTask) {
        const fileName = basename(file);
        // Skip numbered files (e.g., 1-step.md)
        if (!/^\d+-/.test(fileName)) {
          shouldProcess = true;
        }
      }
    }

    if (!shouldProcess) continue;

    const source = getProfileFile(config.profile, file, baseDir);
    if (!source || !existsSync(source)) continue;

    // Extract command name from path
    const cmdName = extractCommandName(file);
    const dest = join(targetDir, `${cmdName}.md`);

    try {
      const content = readFileSync(source, 'utf-8');
      const compiled = compileTemplate(content, baseDir, config.profile, context);

      if (!dryRun) {
        writeFileUtil(compiled, dest);
      }
      files.push({ path: dest, type: 'created' });
      printVerbose(`Installed command: ${cmdName}`);
    } catch (err) {
      errors.push(`Failed to install command ${file}: ${err}`);
    }
  }

  return { success: errors.length === 0, files, errors };
}

/**
 * Install Claude Code agents
 */
export function installClaudeCodeAgents(
  projectDir: string,
  baseDir: string,
  config: EffectiveConfig,
  dryRun = false
): InstallationResult {
  const files: FileOperationResult[] = [];
  const errors: string[] = [];

  if (!dryRun) {
    printStatus('Installing Claude Code agents...');
  }

  const targetDir = join(projectDir, '.claude', 'agents', 'agent-os');
  if (!dryRun) {
    mkdirSync(targetDir, { recursive: true });
  }

  const agentFiles = getProfileFiles(config.profile, baseDir, 'agents');
  const context: ConditionalContext = {
    use_claude_code_subagents: config.use_claude_code_subagents,
    standards_as_claude_code_skills: config.standards_as_claude_code_skills,
    compiled_single_command: false,
  };

  for (const file of agentFiles) {
    // Skip template files
    if (file.includes('templates/')) continue;
    if (!file.endsWith('.md')) continue;

    const source = getProfileFile(config.profile, file, baseDir);
    if (!source || !existsSync(source)) continue;

    // Flatten directory structure - use just the filename
    const fileName = basename(file);
    const dest = join(targetDir, fileName);

    try {
      const content = readFileSync(source, 'utf-8');
      const compiled = compileTemplate(content, baseDir, config.profile, context);

      if (!dryRun) {
        writeFileUtil(compiled, dest);
      }
      files.push({ path: dest, type: 'created' });
      printVerbose(`Installed agent: ${fileName}`);
    } catch (err) {
      errors.push(`Failed to install agent ${file}: ${err}`);
    }
  }

  return { success: errors.length === 0, files, errors };
}

/**
 * Install agent-os commands (for non-Claude Code tools)
 */
export function installAgentOsCommands(
  projectDir: string,
  baseDir: string,
  config: EffectiveConfig,
  dryRun = false
): InstallationResult {
  const files: FileOperationResult[] = [];
  const errors: string[] = [];

  if (!config.agent_os_commands) {
    return { success: true, files, errors };
  }

  if (!dryRun) {
    printStatus('Installing agent-os commands...');
  }

  const commandFiles = getProfileFiles(config.profile, baseDir, 'commands');
  const context: ConditionalContext = {
    use_claude_code_subagents: false,
    standards_as_claude_code_skills: false,
    compiled_single_command: false,
  };

  for (const file of commandFiles) {
    // Only process single-agent files for agent-os commands
    if (!file.includes('/single-agent/') && !file.includes('orchestrate-tasks/orchestrate-tasks.md')) {
      continue;
    }

    const source = getProfileFile(config.profile, file, baseDir);
    if (!source || !existsSync(source)) continue;

    // Determine destination path
    let destPath: string;
    if (file.includes('orchestrate-tasks/orchestrate-tasks.md')) {
      destPath = join(projectDir, 'agent-os', 'commands', 'orchestrate-tasks', 'orchestrate-tasks.md');
    } else {
      // Strip single-agent from path: commands/test-cmd/single-agent/file.md -> commands/test-cmd/file.md
      const relativePath = file.replace('/single-agent/', '/');
      destPath = join(projectDir, 'agent-os', relativePath);
    }

    try {
      const content = readFileSync(source, 'utf-8');
      const compiled = compileTemplate(content, baseDir, config.profile, context);

      if (!dryRun) {
        writeFileUtil(compiled, destPath);
      }
      files.push({ path: destPath, type: 'created' });
      printVerbose(`Installed command: ${basename(destPath)}`);
    } catch (err) {
      errors.push(`Failed to install command ${file}: ${err}`);
    }
  }

  return { success: errors.length === 0, files, errors };
}

/**
 * Extract command name from file path
 */
function extractCommandName(filePath: string): string {
  // commands/test-cmd/multi-agent/test-cmd.md -> test-cmd
  // commands/orchestrate-tasks/orchestrate-tasks.md -> orchestrate-tasks
  const parts = filePath.split('/');
  const commandsIndex = parts.indexOf('commands');
  if (commandsIndex >= 0 && parts.length > commandsIndex + 1) {
    return parts[commandsIndex + 1];
  }
  return basename(filePath, '.md');
}
