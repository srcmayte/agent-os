import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  installStandards,
  installClaudeCodeCommands,
  installClaudeCodeAgents,
  installAgentOsCommands,
} from './installer.js';
import type { EffectiveConfig } from '../types/index.js';

describe('Installer', () => {
  let tempDir: string;
  let baseDir: string;
  let projectDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-test-'));
    baseDir = join(tempDir, 'agent-os');
    projectDir = join(tempDir, 'project');

    // Create base structure
    mkdirSync(join(baseDir, 'profiles', 'default', 'standards'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'default', 'workflows'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'default', 'commands', 'test-cmd', 'multi-agent'), {
      recursive: true,
    });
    mkdirSync(join(baseDir, 'profiles', 'default', 'commands', 'test-cmd', 'single-agent'), {
      recursive: true,
    });
    mkdirSync(join(baseDir, 'profiles', 'default', 'agents'), { recursive: true });

    // Create project structure
    mkdirSync(join(projectDir, 'agent-os'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const defaultConfig: EffectiveConfig = {
    version: '2.1.1',
    profile: 'default',
    claude_code_commands: true,
    use_claude_code_subagents: true,
    agent_os_commands: false,
    standards_as_claude_code_skills: false,
  };

  describe('installStandards', () => {
    test('should install standards files', () => {
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'standards', 'frontend.md'),
        '# Frontend'
      );

      const result = installStandards(projectDir, baseDir, defaultConfig);

      expect(result.files.length).toBeGreaterThan(0);
      expect(existsSync(join(projectDir, 'agent-os', 'standards', 'api.md'))).toBe(true);
      expect(existsSync(join(projectDir, 'agent-os', 'standards', 'frontend.md'))).toBe(true);
    });

    test('should not install in dry-run mode', () => {
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');

      const result = installStandards(projectDir, baseDir, defaultConfig, true);

      expect(result.files.length).toBeGreaterThan(0);
      expect(existsSync(join(projectDir, 'agent-os', 'standards', 'api.md'))).toBe(false);
    });
  });

  describe('installClaudeCodeCommands', () => {
    test('should install multi-agent commands when subagents enabled', () => {
      writeFileSync(
        join(
          baseDir,
          'profiles',
          'default',
          'commands',
          'test-cmd',
          'multi-agent',
          'test-cmd.md'
        ),
        '# Multi-agent command'
      );

      const result = installClaudeCodeCommands(projectDir, baseDir, {
        ...defaultConfig,
        use_claude_code_subagents: true,
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(
        existsSync(join(projectDir, '.claude', 'commands', 'agent-os', 'test-cmd.md'))
      ).toBe(true);
    });

    test('should install single-agent commands when subagents disabled', () => {
      writeFileSync(
        join(
          baseDir,
          'profiles',
          'default',
          'commands',
          'test-cmd',
          'single-agent',
          'test-cmd.md'
        ),
        '# Single-agent command'
      );

      const result = installClaudeCodeCommands(projectDir, baseDir, {
        ...defaultConfig,
        use_claude_code_subagents: false,
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(
        existsSync(join(projectDir, '.claude', 'commands', 'agent-os', 'test-cmd.md'))
      ).toBe(true);
    });
  });

  describe('installClaudeCodeAgents', () => {
    test('should install agent files', () => {
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'agents', 'implementer.md'),
        '# Implementer Agent'
      );

      const result = installClaudeCodeAgents(projectDir, baseDir, defaultConfig);

      expect(result.files.length).toBeGreaterThan(0);
      expect(
        existsSync(join(projectDir, '.claude', 'agents', 'agent-os', 'implementer.md'))
      ).toBe(true);
    });
  });

  describe('installAgentOsCommands', () => {
    test('should install agent-os commands with correct structure', () => {
      writeFileSync(
        join(
          baseDir,
          'profiles',
          'default',
          'commands',
          'test-cmd',
          'single-agent',
          'test-cmd.md'
        ),
        '# Test command'
      );
      writeFileSync(
        join(
          baseDir,
          'profiles',
          'default',
          'commands',
          'test-cmd',
          'single-agent',
          '1-step.md'
        ),
        '# Step 1'
      );

      const result = installAgentOsCommands(projectDir, baseDir, {
        ...defaultConfig,
        agent_os_commands: true,
      });

      expect(result.files.length).toBeGreaterThan(0);
      expect(
        existsSync(join(projectDir, 'agent-os', 'commands', 'test-cmd', 'test-cmd.md'))
      ).toBe(true);
    });
  });
});
