import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { writeFileSync, rmSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { createTimestampedBackup, getBackupCount, getDefaultMaxBackups } from './backup.js';

describe('Backup utilities', () => {
  let sourceDir: string;
  let createdBackups: string[] = [];

  beforeEach(() => {
    // Create source directory in home to test backups properly
    // Using a unique name to avoid conflicts
    const timestamp = Date.now().toString();
    sourceDir = join(homedir(), `agent-os-test-${timestamp}`);
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'config.yml'), 'version: 2.1.1\n');
    writeFileSync(join(sourceDir, 'test.txt'), 'test content\n');
    createdBackups = [];
  });

  afterEach(() => {
    // Clean up source directory
    rmSync(sourceDir, { recursive: true, force: true });
    
    // Clean up any created backups
    for (const backup of createdBackups) {
      if (existsSync(backup)) {
        rmSync(backup, { recursive: true, force: true });
      }
    }
    
    // Also clean up any backups with the source dir basename pattern
    const baseName = basename(sourceDir);
    const parentDir = homedir();
    try {
      const entries = readdirSync(parentDir);
      for (const entry of entries) {
        if (entry.startsWith(`${baseName}.backup`)) {
          rmSync(join(parentDir, entry), { recursive: true, force: true });
        }
      }
    } catch {
      // Ignore errors
    }
    
    delete process.env.AGENT_OS_MAX_BACKUPS;
  });

  describe('getDefaultMaxBackups', () => {
    test('should return default max backups value', () => {
      const max = getDefaultMaxBackups();
      expect(max).toBe(10);
    });
  });

  describe('getBackupCount', () => {
    test('should return 0 when no backups exist', () => {
      const count = getBackupCount(sourceDir);
      expect(count).toBe(0);
    });

    test('should count existing backups', () => {
      // Create some backup directories
      const baseName = basename(sourceDir);
      const backupDir1 = join(homedir(), `${baseName}.backup-20231201-120000`);
      const backupDir2 = join(homedir(), `${baseName}.backup-20231202-120000`);
      mkdirSync(backupDir1, { recursive: true });
      mkdirSync(backupDir2, { recursive: true });
      createdBackups.push(backupDir1, backupDir2);
      
      const count = getBackupCount(sourceDir);
      expect(count).toBe(2);
    });
  });

  describe('createTimestampedBackup', () => {
    test('should throw error when source directory does not exist', () => {
      const nonExistentDir = join(homedir(), 'agent-os-non-existent-test');
      expect(() => createTimestampedBackup(nonExistentDir)).toThrow('Source directory does not exist');
    });

    test('should create a timestamped backup directory', () => {
      const backupPath = createTimestampedBackup(sourceDir);
      createdBackups.push(backupPath);
      
      expect(existsSync(backupPath)).toBe(true);
      expect(backupPath).toContain('.backup-');
      
      // Verify content was copied
      expect(existsSync(join(backupPath, 'config.yml'))).toBe(true);
      expect(existsSync(join(backupPath, 'test.txt'))).toBe(true);
    });

    test('should increment backup count', () => {
      expect(getBackupCount(sourceDir)).toBe(0);
      
      const backupPath = createTimestampedBackup(sourceDir);
      createdBackups.push(backupPath);
      
      expect(getBackupCount(sourceDir)).toBe(1);
    });

    test('should respect AGENT_OS_MAX_BACKUPS environment variable', () => {
      process.env.AGENT_OS_MAX_BACKUPS = '2';
      
      // Create 2 backups to hit the limit (max is 2)
      const baseName = basename(sourceDir);
      const backupDir1 = join(homedir(), `${baseName}.backup-20231201-120000`);
      const backupDir2 = join(homedir(), `${baseName}.backup-20231202-120000`);
      mkdirSync(backupDir1, { recursive: true });
      mkdirSync(backupDir2, { recursive: true });
      createdBackups.push(backupDir1, backupDir2);
      
      // Creating a new backup should purge the oldest one
      const newBackup = createTimestampedBackup(sourceDir);
      createdBackups.push(newBackup);
      
      // Should now have exactly 2 backups (oldest purged, new one created)
      expect(getBackupCount(sourceDir)).toBe(2);
    });

    test('should ignore invalid AGENT_OS_MAX_BACKUPS values', () => {
      process.env.AGENT_OS_MAX_BACKUPS = 'invalid';
      
      // Should use default without throwing
      const backupPath = createTimestampedBackup(sourceDir);
      createdBackups.push(backupPath);
      
      expect(existsSync(backupPath)).toBe(true);
    });
  });
});
