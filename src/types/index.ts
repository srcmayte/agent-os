/**
 * Type definitions for Agent OS CLI
 */

/**
 * Base configuration from ~/agent-os/config.yml
 */
export interface BaseConfig {
  version: string;
  base_install?: boolean;
  profile: string;
  claude_code_commands: boolean;
  use_claude_code_subagents: boolean;
  agent_os_commands: boolean;
  standards_as_claude_code_skills: boolean;
}

/**
 * Project configuration from project/agent-os/config.yml
 */
export interface ProjectConfig {
  version: string;
  last_compiled?: string;
  profile: string;
  claude_code_commands: boolean;
  use_claude_code_subagents: boolean;
  agent_os_commands: boolean;
  standards_as_claude_code_skills: boolean;
}

/**
 * Profile configuration from profiles/<name>/profile-config.yml
 */
export interface ProfileConfig {
  inherits_from?: string | false;
  exclude_inherited_files?: string[];
}

/**
 * Effective configuration (resolved from CLI args, base, and project)
 */
export interface EffectiveConfig {
  profile: string;
  claude_code_commands: boolean;
  use_claude_code_subagents: boolean;
  agent_os_commands: boolean;
  standards_as_claude_code_skills: boolean;
  version: string;
}

/**
 * Command line options for project-install
 */
export interface ProjectInstallOptions {
  profile?: string;
  claudeCodeCommands?: boolean;
  useClaudeCodeSubagents?: boolean;
  agentOsCommands?: boolean;
  standardsAsClaudeCodeSkills?: boolean;
  reInstall?: boolean;
  overwriteAll?: boolean;
  overwriteStandards?: boolean;
  overwriteCommands?: boolean;
  overwriteAgents?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Command line options for project-update
 */
export interface ProjectUpdateOptions extends ProjectInstallOptions {}

/**
 * Command line options for create-profile
 */
export interface CreateProfileOptions {
  name?: string;
  inheritsFrom?: string;
  copyFrom?: string;
}

/**
 * Command line options for base-install
 */
export interface BaseInstallOptions {
  verbose?: boolean;
}

/**
 * Update choice for base installation
 */
export enum UpdateChoice {
  FULL_UPDATE = 1,
  UPDATE_PROFILE = 2,
  UPDATE_SCRIPTS = 3,
  UPDATE_CONFIG = 4,
  DELETE_REINSTALL = 5,
  CANCEL = 6,
}

/**
 * File operation result
 */
export interface FileOperationResult {
  path: string;
  type: 'created' | 'updated' | 'skipped' | 'deleted';
}

/**
 * Installation result
 */
export interface InstallationResult {
  success: boolean;
  files: FileOperationResult[];
  errors: string[];
}
