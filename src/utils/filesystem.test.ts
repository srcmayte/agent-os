import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ensureDir, copyFile, writeFile, normalizeName, matchesExclusionPattern } from './filesystem.js';

describe('Filesystem utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('ensureDir', () => {
    test('should create directory if it does not exist', () => {
      const newDir = join(tempDir, 'new-directory');
      expect(existsSync(newDir)).toBe(false);
      ensureDir(newDir);
      expect(existsSync(newDir)).toBe(true);
    });

    test('should not throw if directory already exists', () => {
      const existingDir = join(tempDir, 'existing');
      mkdirSync(existingDir);
      expect(() => ensureDir(existingDir)).not.toThrow();
    });

    test('should create nested directories', () => {
      const nestedDir = join(tempDir, 'a', 'b', 'c');
      ensureDir(nestedDir);
      expect(existsSync(nestedDir)).toBe(true);
    });

    test('should return the directory path in non-dry-run mode', () => {
      const newDir = join(tempDir, 'test-dir');
      const result = ensureDir(newDir);
      expect(result).toBe(newDir);
    });

    test('should not create directory in dry-run mode', () => {
      const newDir = join(tempDir, 'dry-run-dir');
      const result = ensureDir(newDir, true);
      expect(existsSync(newDir)).toBe(false);
      expect(result).toBe(newDir);
    });
  });

  describe('copyFile', () => {
    test('should copy file to destination', () => {
      const sourceFile = join(tempDir, 'source.txt');
      const destFile = join(tempDir, 'dest.txt');
      writeFileSync(sourceFile, 'test content');

      copyFile(sourceFile, destFile);

      expect(existsSync(destFile)).toBe(true);
      expect(readFileSync(destFile, 'utf-8')).toBe('test content');
    });

    test('should create parent directories if needed', () => {
      const sourceFile = join(tempDir, 'source.txt');
      const destFile = join(tempDir, 'nested', 'dir', 'dest.txt');
      writeFileSync(sourceFile, 'test content');

      copyFile(sourceFile, destFile);

      expect(existsSync(destFile)).toBe(true);
    });

    test('should not copy in dry-run mode', () => {
      const sourceFile = join(tempDir, 'source.txt');
      const destFile = join(tempDir, 'dest.txt');
      writeFileSync(sourceFile, 'test content');

      const result = copyFile(sourceFile, destFile, true);

      expect(existsSync(destFile)).toBe(false);
      expect(result).toBe(destFile);
    });
  });

  describe('writeFile', () => {
    test('should write content to file', () => {
      const destFile = join(tempDir, 'output.txt');
      writeFile('hello world', destFile);
      expect(readFileSync(destFile, 'utf-8')).toBe('hello world');
    });

    test('should create parent directories if needed', () => {
      const destFile = join(tempDir, 'nested', 'output.txt');
      writeFile('content', destFile);
      expect(existsSync(destFile)).toBe(true);
    });

    test('should not write in dry-run mode', () => {
      const destFile = join(tempDir, 'dry-run.txt');
      const result = writeFile('content', destFile, true);
      expect(existsSync(destFile)).toBe(false);
      expect(result).toBe(destFile);
    });
  });

  describe('normalizeName', () => {
    test('should convert to lowercase', () => {
      expect(normalizeName('MyProfile')).toBe('myprofile');
    });

    test('should replace spaces with hyphens', () => {
      expect(normalizeName('my profile')).toBe('my-profile');
    });

    test('should replace underscores with hyphens', () => {
      expect(normalizeName('my_profile')).toBe('my-profile');
    });

    test('should remove special characters', () => {
      expect(normalizeName('my@profile!')).toBe('myprofile');
    });

    test('should handle complex input', () => {
      expect(normalizeName('My_Test Profile! 123')).toBe('my-test-profile-123');
    });
  });

  describe('matchesExclusionPattern', () => {
    const patterns = ['scripts/base-install.sh', 'old-versions/*', '.git*', '.github/*'];

    test('should match exact paths', () => {
      expect(matchesExclusionPattern('scripts/base-install.sh', patterns)).toBe(true);
      expect(matchesExclusionPattern('scripts/other.sh', patterns)).toBe(false);
    });

    test('should match wildcard suffix patterns', () => {
      expect(matchesExclusionPattern('old-versions/v1.0', patterns)).toBe(true);
      expect(matchesExclusionPattern('old-versions/backup/file.txt', patterns)).toBe(true);
      expect(matchesExclusionPattern('new-versions/v1.0', patterns)).toBe(false);
    });

    test('should match wildcard prefix patterns', () => {
      expect(matchesExclusionPattern('.git', patterns)).toBe(true);
      expect(matchesExclusionPattern('.github', patterns)).toBe(true);
      expect(matchesExclusionPattern('.gitignore', patterns)).toBe(true);
      expect(matchesExclusionPattern('.github/workflows', patterns)).toBe(true);
    });

    test('should not match non-matching paths', () => {
      expect(matchesExclusionPattern('profiles/default/standards/api.md', patterns)).toBe(false);
      expect(matchesExclusionPattern('config.yml', patterns)).toBe(false);
      expect(matchesExclusionPattern('README.md', patterns)).toBe(false);
    });

    test('should handle empty patterns array', () => {
      expect(matchesExclusionPattern('any/path', [])).toBe(false);
    });
  });
});
