import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, rmSync } from 'fs';
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
  function runCli(args: string[], options: { cwd?: string; input?: string } = {}): {
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
  });
});
