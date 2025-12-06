/**
 * Shared utilities for project commands
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { loadProjectConfig } from '../../lib/config.js';
import { printStatus, Colors } from '../../utils/output.js';

/**
 * Check if this is the base installation directory
 * Prioritizes config-based detection over path-based detection
 */
export function checkIsBaseInstallation(projectDir: string): boolean {
  const configPath = join(projectDir, 'agent-os', 'config.yml');
  if (!existsSync(configPath)) {
    return false;
  }

  const config = loadProjectConfig(projectDir);
  
  // Check if this is the base installation via config marker
  if (config && 'base_install' in config) {
    return true;
  }
  
  // Fallback: check if the base config.yml exists (indicating ~/agent-os directory)
  const baseConfigPath = join(projectDir, 'config.yml');
  return existsSync(baseConfigPath);
}

/**
 * Display configuration summary
 */
export function displayConfiguration(effectiveConfig: {
  profile: string;
  claude_code_commands: boolean;
  use_claude_code_subagents: boolean;
  agent_os_commands: boolean;
}): void {
  printStatus('Configuration:');
  console.log(`  Profile: ${Colors.YELLOW}${effectiveConfig.profile}${Colors.RESET}`);
  console.log(`  Claude Code Commands: ${Colors.YELLOW}${effectiveConfig.claude_code_commands}${Colors.RESET}`);
  console.log(`  Subagents: ${Colors.YELLOW}${effectiveConfig.use_claude_code_subagents}${Colors.RESET}`);
  console.log(`  Agent OS Commands: ${Colors.YELLOW}${effectiveConfig.agent_os_commands}${Colors.RESET}`);
  console.log('');
}
