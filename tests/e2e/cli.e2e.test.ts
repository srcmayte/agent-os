import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

/**
 * E2E tests for the Agent OS CLI
 * These tests verify the CLI commands work correctly end-to-end
 */
describe('CLI E2E Tests', () => {
  const cliPath = join(process.cwd(), 'dist', 'index.js');

  /**
   * Helper to run CLI command and capture output
   */
  function runCli(args: string[], options: { cwd?: string; input?: string; env?: Record<string, string> } = {}): {
    stdout: string;
    stderr: string;
    exitCode: number | null;
  } {
    try {
      const result = execSync(`node ${cliPath} ${args.join(' ')}`, {
        cwd: options.cwd || process.cwd(),
        encoding: 'utf-8',
        timeout: 10000,
        input: options.input,
        env: { ...process.env, ...options.env },
      });
      return { stdout: result, stderr: '', exitCode: 0 };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || '',
        exitCode: execError.status || 1,
      };
    }
  }

  describe('CLI version and help', () => {
    test('should display version', () => {
      const { stdout, exitCode } = runCli(['--version']);
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('should display help', () => {
      const { stdout, exitCode } = runCli(['--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('agent-os');
      expect(stdout).toContain('install');
      expect(stdout).toContain('project');
      expect(stdout).toContain('create-profile');
    });

    test('should display install command help', () => {
      const { stdout, exitCode } = runCli(['install', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Install Agent OS base installation');
      expect(stdout).toContain('--verbose');
    });

    test('should display project command help', () => {
      const { stdout, exitCode } = runCli(['project', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Project-related commands');
      expect(stdout).toContain('setup');
      expect(stdout).toContain('sync');
    });

    test('should display project setup help', () => {
      const { stdout, exitCode } = runCli(['project', 'setup', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Set up Agent OS');
      expect(stdout).toContain('--profile');
      expect(stdout).toContain('--dry-run');
    });

    test('should display project sync help', () => {
      const { stdout, exitCode } = runCli(['project', 'sync', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Sync/update Agent OS');
      expect(stdout).toContain('--dry-run');
    });

    test('should display create-profile help', () => {
      const { stdout, exitCode } = runCli(['create-profile', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Create a new Agent OS profile');
      expect(stdout).toContain('--name');
      expect(stdout).toContain('--inherits-from');
    });
  });

  describe('CLI aliases', () => {
    test('should recognize "init" alias for install', () => {
      const { stdout, exitCode } = runCli(['init', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Install Agent OS base installation');
    });

    test('should recognize "setup" alias for install', () => {
      const { stdout, exitCode } = runCli(['setup', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Install Agent OS base installation');
    });

    test('should recognize "profile" alias for create-profile', () => {
      const { stdout, exitCode } = runCli(['profile', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Create a new Agent OS profile');
    });

    test('should recognize project sync update alias', () => {
      const { stdout, exitCode } = runCli(['project', 'update', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Sync/update Agent OS');
    });

    test('should recognize project install alias', () => {
      const { stdout, exitCode } = runCli(['project', 'install', '--help']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Set up Agent OS');
    });
  });

  describe('project setup validation', () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'agent-os-e2e-'));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test('should fail when base installation does not exist', () => {
      const { exitCode } = runCli(['project', 'setup'], { cwd: tempDir });
      // Should exit with error about missing base installation
      expect(exitCode).not.toBe(0);
    });

    test('should fail when trying to install in base directory', () => {
      // Create mock base installation
      const baseDir = join(tempDir, 'agent-os');
      mkdirSync(baseDir, { recursive: true });
      writeFileSync(join(baseDir, 'config.yml'), 'version: 2.1.1\nbase_install: true');
      
      // Try to install in base directory itself
      const { exitCode, stderr, stdout } = runCli(['project', 'setup'], { 
        cwd: baseDir,
        env: { HOME: tempDir }
      });
      
      // Should exit with error
      expect(exitCode).not.toBe(0);
    });
  });

  describe('project setup dry-run', () => {
    let tempDir: string;
    let baseDir: string;
    let projectDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'agent-os-e2e-'));
      baseDir = join(tempDir, 'agent-os');
      projectDir = join(tempDir, 'test-project');

      // Create base installation structure
      mkdirSync(join(baseDir, 'profiles', 'default', 'standards'), { recursive: true });
      mkdirSync(join(baseDir, 'profiles', 'default', 'workflows'), { recursive: true });
      mkdirSync(join(baseDir, 'profiles', 'default', 'commands', 'test-cmd', 'multi-agent'), {
        recursive: true,
      });
      mkdirSync(join(baseDir, 'profiles', 'default', 'agents'), { recursive: true });

      // Create base config
      writeFileSync(
        join(baseDir, 'config.yml'),
        `version: 2.1.1
base_install: true
profile: default
claude_code_commands: true
use_claude_code_subagents: true
agent_os_commands: false
standards_as_claude_code_skills: false
`
      );

      // Create sample standards
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'standards', 'api.md'),
        '# API Standards\n\nThese are the API standards.'
      );

      // Create sample workflow
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'workflows', 'implementation.md'),
        '# Implementation Workflow\n\nStep 1: Plan\nStep 2: Build\nStep 3: Test'
      );

      // Create sample command
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'commands', 'test-cmd', 'multi-agent', 'test-cmd.md'),
        '# Test Command\n\n{{workflows/implementation}}'
      );

      // Create sample agent
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'agents', 'implementer.md'),
        '# Implementer Agent'
      );

      // Create project directory
      mkdirSync(projectDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test('should show dry-run output without creating files', () => {
      const { stdout, exitCode } = runCli(['project', 'setup', '--dry-run'], { 
        cwd: projectDir,
        env: { HOME: tempDir }
      });
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('DRY RUN');
      
      // Verify no files were actually created
      expect(existsSync(join(projectDir, 'agent-os'))).toBe(false);
      expect(existsSync(join(projectDir, '.claude'))).toBe(false);
    });

    test('should support --profile option', () => {
      const { stdout, exitCode } = runCli(['project', 'setup', '--dry-run', '--profile', 'default'], { 
        cwd: projectDir,
        env: { HOME: tempDir }
      });
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('default');
    });

    test('should support --agent-os-commands option with dry-run', () => {
      const { stdout, exitCode } = runCli(['project', 'setup', '--dry-run', '--agent-os-commands=true'], { 
        cwd: projectDir,
        env: { HOME: tempDir }
      });
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('DRY RUN');
    });
  });

  describe('create-profile command', () => {
    let tempDir: string;
    let baseDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'agent-os-e2e-'));
      baseDir = join(tempDir, 'agent-os');

      // Create base installation structure
      mkdirSync(join(baseDir, 'profiles', 'default', 'standards'), { recursive: true });
      writeFileSync(join(baseDir, 'config.yml'), 'version: 2.1.1\nbase_install: true\nprofile: default');
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    test('should fail when base installation does not exist', () => {
      const nonExistentDir = join(tempDir, 'non-existent');
      const { exitCode } = runCli(['create-profile', '--name', 'test-profile'], { 
        env: { HOME: nonExistentDir }
      });
      
      expect(exitCode).not.toBe(0);
    });

    test('should show help with correct profile name examples', () => {
      const { stdout, exitCode } = runCli(['create-profile', '--help']);
      
      expect(exitCode).toBe(0);
      expect(stdout).toContain('--name');
      expect(stdout).toContain('--inherits-from');
    });
  });
});
