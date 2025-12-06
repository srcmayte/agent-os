import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadBaseConfig,
  loadProjectConfig,
  validateConfig,
  getEffectiveConfig,
  writeProjectConfig,
  DEFAULT_CONFIG,
  validateBaseInstallation,
  isAgentOsInstalled,
} from './config.js';

describe('Configuration management', () => {
  let tempDir: string;
  let baseDir: string;
  let projectDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-test-'));
    baseDir = join(tempDir, 'agent-os');
    projectDir = join(tempDir, 'project');
    mkdirSync(baseDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });
    mkdirSync(join(projectDir, 'agent-os'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'default'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadBaseConfig', () => {
    test('should load a valid base config', () => {
      writeFileSync(
        join(baseDir, 'config.yml'),
        `
version: 2.1.1
base_install: true
profile: default
claude_code_commands: true
use_claude_code_subagents: true
agent_os_commands: false
standards_as_claude_code_skills: false
`
      );

      const config = loadBaseConfig(baseDir);
      expect(config).not.toBeNull();
      expect(config?.version).toBe('2.1.1');
      expect(config?.profile).toBe('default');
      expect(config?.claude_code_commands).toBe(true);
      expect(config?.use_claude_code_subagents).toBe(true);
      expect(config?.agent_os_commands).toBe(false);
    });

    test('should return null when config does not exist', () => {
      const config = loadBaseConfig('/nonexistent');
      expect(config).toBeNull();
    });

    test('should use default values for missing fields', () => {
      writeFileSync(
        join(baseDir, 'config.yml'),
        `
version: 2.1.1
`
      );

      const config = loadBaseConfig(baseDir);
      expect(config?.profile).toBe(DEFAULT_CONFIG.profile);
      expect(config?.claude_code_commands).toBe(DEFAULT_CONFIG.claude_code_commands);
    });
  });

  describe('loadProjectConfig', () => {
    test('should load a valid project config', () => {
      writeFileSync(
        join(projectDir, 'agent-os', 'config.yml'),
        `
version: 2.1.1
profile: default
claude_code_commands: true
use_claude_code_subagents: false
agent_os_commands: true
standards_as_claude_code_skills: true
`
      );

      const config = loadProjectConfig(projectDir);
      expect(config).not.toBeNull();
      expect(config?.version).toBe('2.1.1');
      expect(config?.use_claude_code_subagents).toBe(false);
      expect(config?.agent_os_commands).toBe(true);
    });

    test('should return null when project config does not exist', () => {
      const config = loadProjectConfig('/nonexistent');
      expect(config).toBeNull();
    });
  });

  describe('validateConfig', () => {
    test('should pass with valid configuration', () => {
      const result = validateConfig(
        {
          profile: 'default',
          claude_code_commands: true,
          use_claude_code_subagents: true,
          agent_os_commands: false,
          standards_as_claude_code_skills: false,
          version: '2.1.1',
        },
        baseDir
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should fail when no output is enabled', () => {
      const result = validateConfig(
        {
          profile: 'default',
          claude_code_commands: false,
          use_claude_code_subagents: false,
          agent_os_commands: false,
          standards_as_claude_code_skills: false,
          version: '2.1.1',
        },
        baseDir
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should warn when subagents enabled without claude code commands', () => {
      const result = validateConfig(
        {
          profile: 'default',
          claude_code_commands: false,
          use_claude_code_subagents: true,
          agent_os_commands: true,
          standards_as_claude_code_skills: false,
          version: '2.1.1',
        },
        baseDir
      );
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should fail when profile does not exist', () => {
      const result = validateConfig(
        {
          profile: 'nonexistent',
          claude_code_commands: true,
          use_claude_code_subagents: false,
          agent_os_commands: false,
          standards_as_claude_code_skills: false,
          version: '2.1.1',
        },
        baseDir
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('getEffectiveConfig', () => {
    test('should merge CLI args, base config, and project config correctly', () => {
      writeFileSync(
        join(baseDir, 'config.yml'),
        `
version: 2.1.1
profile: default
claude_code_commands: true
use_claude_code_subagents: true
agent_os_commands: false
standards_as_claude_code_skills: false
`
      );

      writeFileSync(
        join(projectDir, 'agent-os', 'config.yml'),
        `
version: 2.0.0
profile: rails
claude_code_commands: false
use_claude_code_subagents: false
agent_os_commands: true
standards_as_claude_code_skills: true
`
      );

      const cliOptions = {
        profile: 'custom',
      };

      const effective = getEffectiveConfig(cliOptions, baseDir, projectDir);

      // CLI takes precedence
      expect(effective.profile).toBe('custom');
      // Base config for version
      expect(effective.version).toBe('2.1.1');
      // Base config for other fields
      expect(effective.claude_code_commands).toBe(true);
    });

    test('should use base config when no CLI args provided', () => {
      writeFileSync(
        join(baseDir, 'config.yml'),
        `
version: 2.1.1
profile: default
claude_code_commands: true
use_claude_code_subagents: true
agent_os_commands: false
standards_as_claude_code_skills: false
`
      );

      const effective = getEffectiveConfig({}, baseDir, projectDir);
      expect(effective.profile).toBe('default');
      expect(effective.claude_code_commands).toBe(true);
    });
  });

  describe('writeProjectConfig', () => {
    test('should write project config file', () => {
      const config = {
        version: '2.1.1',
        profile: 'default',
        claude_code_commands: true,
        use_claude_code_subagents: false,
        agent_os_commands: true,
        standards_as_claude_code_skills: false,
      };

      writeProjectConfig(projectDir, config);

      const written = loadProjectConfig(projectDir);
      expect(written?.version).toBe('2.1.1');
      expect(written?.profile).toBe('default');
    });
  });

  describe('validateBaseInstallation', () => {
    test('should return true when config.yml exists', () => {
      writeFileSync(join(baseDir, 'config.yml'), 'version: 2.1.1\n');
      expect(validateBaseInstallation(baseDir)).toBe(true);
    });

    test('should return false when config.yml does not exist', () => {
      expect(validateBaseInstallation(baseDir)).toBe(false);
    });
  });

  describe('isAgentOsInstalled', () => {
    test('should return true when project config exists', () => {
      writeFileSync(join(projectDir, 'agent-os', 'config.yml'), 'version: 2.1.1\n');
      expect(isAgentOsInstalled(projectDir)).toBe(true);
    });

    test('should return false when project config does not exist', () => {
      rmSync(join(projectDir, 'agent-os', 'config.yml'), { force: true });
      expect(isAgentOsInstalled(projectDir)).toBe(false);
    });
  });
});
