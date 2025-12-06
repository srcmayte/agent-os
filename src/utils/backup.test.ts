import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createTimestampedBackup, getBackupCount, getDefaultMaxBackups } from './backup.js';

describe('Backup utilities', () => {
  let tempDir: string;
  let sourceDir: string;

  beforeEach(() => {
    // Create a unique temp directory that simulates home directory structure
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-backup-test-'));
    sourceDir = join(tempDir, 'test-source');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, 'config.yml'), 'version: 2.1.1\n');
    writeFileSync(join(sourceDir, 'test.txt'), 'test content\n');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
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
  });

  describe('createTimestampedBackup', () => {
    test('should throw error when source directory does not exist', () => {
      const nonExistentDir = join(tempDir, 'non-existent');
      expect(() => createTimestampedBackup(nonExistentDir)).toThrow('Source directory does not exist');
    });
  });
});
