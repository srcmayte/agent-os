/**
 * Configuration management for Agent OS CLI
 * Handles loading, validating, and merging configuration
 */

import { existsSync } from 'fs';
import { join } from 'path';
import type { BaseConfig, ProjectConfig, EffectiveConfig, ProjectInstallOptions } from '../types/index.js';
import { parseYamlFile } from '../utils/yaml.js';
import { writeFile } from '../utils/filesystem.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: BaseConfig = {
  version: '2.1.1',
  base_install: false,
  profile: 'default',
  claude_code_commands: true,
  use_claude_code_subagents: true,
  agent_os_commands: false,
  standards_as_claude_code_skills: false,
};

/**
 * Load base configuration from ~/agent-os/config.yml
 */
export function loadBaseConfig(baseDir: string): BaseConfig | null {
  const configPath = join(baseDir, 'config.yml');
  const data = parseYamlFile<Partial<BaseConfig>>(configPath);

  if (!data) {
    return null;
  }

  return {
    version: String(data.version ?? DEFAULT_CONFIG.version),
    base_install: Boolean(data.base_install ?? DEFAULT_CONFIG.base_install),
    profile: String(data.profile ?? DEFAULT_CONFIG.profile),
    claude_code_commands: Boolean(data.claude_code_commands ?? DEFAULT_CONFIG.claude_code_commands),
    use_claude_code_subagents: Boolean(
      data.use_claude_code_subagents ?? DEFAULT_CONFIG.use_claude_code_subagents
    ),
    agent_os_commands: Boolean(data.agent_os_commands ?? DEFAULT_CONFIG.agent_os_commands),
    standards_as_claude_code_skills: Boolean(
      data.standards_as_claude_code_skills ?? DEFAULT_CONFIG.standards_as_claude_code_skills
    ),
  };
}

/**
 * Load project configuration from project/agent-os/config.yml
 */
export function loadProjectConfig(projectDir: string): ProjectConfig | null {
  const configPath = join(projectDir, 'agent-os', 'config.yml');
  const data = parseYamlFile<Partial<ProjectConfig>>(configPath);

  if (!data) {
    return null;
  }

  return {
    version: String(data.version ?? ''),
    last_compiled: data.last_compiled ? String(data.last_compiled) : undefined,
    profile: String(data.profile ?? DEFAULT_CONFIG.profile),
    claude_code_commands: Boolean(data.claude_code_commands ?? DEFAULT_CONFIG.claude_code_commands),
    use_claude_code_subagents: Boolean(
      data.use_claude_code_subagents ?? DEFAULT_CONFIG.use_claude_code_subagents
    ),
    agent_os_commands: Boolean(data.agent_os_commands ?? DEFAULT_CONFIG.agent_os_commands),
    standards_as_claude_code_skills: Boolean(
      data.standards_as_claude_code_skills ?? DEFAULT_CONFIG.standards_as_claude_code_skills
    ),
  };
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate configuration
 */
export function validateConfig(config: EffectiveConfig, baseDir: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // At least one output must be enabled
  if (!config.claude_code_commands && !config.agent_os_commands) {
    errors.push("At least one of 'claude_code_commands' or 'agent_os_commands' must be true");
  }

  // Subagents require Claude Code commands
  if (config.use_claude_code_subagents && !config.claude_code_commands) {
    warnings.push('use_claude_code_subagents requires claude_code_commands to be true');
  }

  // Skills require Claude Code commands
  if (config.standards_as_claude_code_skills && !config.claude_code_commands) {
    warnings.push('standards_as_claude_code_skills requires claude_code_commands to be true');
  }

  // Profile must exist
  const profileDir = join(baseDir, 'profiles', config.profile);
  if (!existsSync(profileDir)) {
    errors.push(`Profile not found: ${config.profile}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get effective configuration by merging CLI args, base config, and project config
 */
export function getEffectiveConfig(
  cliOptions: Partial<ProjectInstallOptions>,
  baseDir: string,
  _projectDir?: string
): EffectiveConfig {
  const baseConfig = loadBaseConfig(baseDir);

  // Start with defaults
  let effective: EffectiveConfig = {
    version: baseConfig?.version ?? DEFAULT_CONFIG.version,
    profile: DEFAULT_CONFIG.profile,
    claude_code_commands: DEFAULT_CONFIG.claude_code_commands,
    use_claude_code_subagents: DEFAULT_CONFIG.use_claude_code_subagents,
    agent_os_commands: DEFAULT_CONFIG.agent_os_commands,
    standards_as_claude_code_skills: DEFAULT_CONFIG.standards_as_claude_code_skills,
  };

  // Override with base config
  if (baseConfig) {
    effective = {
      ...effective,
      version: baseConfig.version,
      profile: baseConfig.profile,
      claude_code_commands: baseConfig.claude_code_commands,
      use_claude_code_subagents: baseConfig.use_claude_code_subagents,
      agent_os_commands: baseConfig.agent_os_commands,
      standards_as_claude_code_skills: baseConfig.standards_as_claude_code_skills,
    };
  }

  // Override with CLI options (only if explicitly provided)
  if (cliOptions.profile !== undefined) {
    effective.profile = cliOptions.profile;
  }
  if (cliOptions.claudeCodeCommands !== undefined) {
    effective.claude_code_commands = cliOptions.claudeCodeCommands;
  }
  if (cliOptions.useClaudeCodeSubagents !== undefined) {
    effective.use_claude_code_subagents = cliOptions.useClaudeCodeSubagents;
  }
  if (cliOptions.agentOsCommands !== undefined) {
    effective.agent_os_commands = cliOptions.agentOsCommands;
  }
  if (cliOptions.standardsAsClaudeCodeSkills !== undefined) {
    effective.standards_as_claude_code_skills = cliOptions.standardsAsClaudeCodeSkills;
  }

  return effective;
}

/**
 * Write project configuration file
 */
export function writeProjectConfig(
  projectDir: string,
  config: EffectiveConfig,
  dryRun = false
): string {
  const configPath = join(projectDir, 'agent-os', 'config.yml');
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const content = `version: ${config.version}
last_compiled: ${timestamp}

# ================================================
# Compiled with the following settings:
#
# To change these settings, run ~/agent-os/scripts/project-update.sh to re-compile your project with the new settings.
# ================================================
profile: ${config.profile}
claude_code_commands: ${config.claude_code_commands}
use_claude_code_subagents: ${config.use_claude_code_subagents}
agent_os_commands: ${config.agent_os_commands}
standards_as_claude_code_skills: ${config.standards_as_claude_code_skills}
`;

  return writeFile(content, configPath, dryRun);
}

/**
 * Check if Agent OS is installed in a project
 */
export function isAgentOsInstalled(projectDir: string): boolean {
  return existsSync(join(projectDir, 'agent-os', 'config.yml'));
}

/**
 * Get the base installation directory (~/agent-os)
 */
export function getBaseDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  return join(homeDir, 'agent-os');
}

/**
 * Check if needs migration to 2.1.0
 */
export function needsMigration(projectVersion: string): boolean {
  if (!projectVersion) {
    return true;
  }

  const parts = projectVersion.split('.');
  const major = parseInt(parts[0] || '0', 10);
  const minor = parseInt(parts[1] || '0', 10);

  if (major < 2) {
    return true;
  }
  if (major === 2 && minor < 1) {
    return true;
  }

  return false;
}
