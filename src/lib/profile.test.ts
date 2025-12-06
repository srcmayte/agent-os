import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  loadProfileConfig,
  getProfileFile,
  getProfileFiles,
  matchPattern,
} from './profile.js';

describe('Profile management', () => {
  let tempDir: string;
  let baseDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-test-'));
    baseDir = join(tempDir, 'agent-os');
    mkdirSync(join(baseDir, 'profiles', 'default', 'standards'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'default', 'workflows'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'custom', 'standards'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadProfileConfig', () => {
    test('should load profile config with inheritance', () => {
      writeFileSync(
        join(baseDir, 'profiles', 'custom', 'profile-config.yml'),
        `
inherits_from: default
exclude_inherited_files:
  - standards/backend/*
`
      );

      const config = loadProfileConfig(baseDir, 'custom');
      expect(config).not.toBeNull();
      expect(config?.inherits_from).toBe('default');
      expect(config?.exclude_inherited_files).toContain('standards/backend/*');
    });

    test('should return null for missing profile', () => {
      const config = loadProfileConfig(baseDir, 'nonexistent');
      expect(config).toBeNull();
    });

    test('should return default values for missing config file', () => {
      // default profile exists but has no profile-config.yml
      const config = loadProfileConfig(baseDir, 'default');
      expect(config).toEqual({
        inherits_from: undefined,
        exclude_inherited_files: [],
      });
    });
  });

  describe('matchPattern', () => {
    test('should match exact paths', () => {
      expect(matchPattern('standards/api.md', 'standards/api.md')).toBe(true);
      expect(matchPattern('standards/api.md', 'standards/other.md')).toBe(false);
    });

    test('should match wildcard patterns', () => {
      expect(matchPattern('standards/backend/api.md', 'standards/backend/*')).toBe(true);
      expect(matchPattern('standards/frontend/css.md', 'standards/backend/*')).toBe(false);
    });

    test('should match double wildcard patterns', () => {
      expect(matchPattern('standards/backend/api/rest.md', 'standards/**')).toBe(true);
    });
  });

  describe('getProfileFile', () => {
    test('should get file from current profile', () => {
      const filePath = join(baseDir, 'profiles', 'default', 'standards', 'api.md');
      writeFileSync(filePath, '# API Standards');

      const result = getProfileFile('default', 'standards/api.md', baseDir);
      expect(result).toBe(filePath);
    });

    test('should inherit file from parent profile', () => {
      const parentFile = join(baseDir, 'profiles', 'default', 'standards', 'api.md');
      writeFileSync(parentFile, '# API Standards');
      writeFileSync(
        join(baseDir, 'profiles', 'custom', 'profile-config.yml'),
        'inherits_from: default'
      );

      const result = getProfileFile('custom', 'standards/api.md', baseDir);
      expect(result).toBe(parentFile);
    });

    test('should override parent file with child file', () => {
      const parentFile = join(baseDir, 'profiles', 'default', 'standards', 'api.md');
      const childFile = join(baseDir, 'profiles', 'custom', 'standards', 'api.md');
      writeFileSync(parentFile, '# Default API');
      writeFileSync(childFile, '# Custom API');
      writeFileSync(
        join(baseDir, 'profiles', 'custom', 'profile-config.yml'),
        'inherits_from: default'
      );

      const result = getProfileFile('custom', 'standards/api.md', baseDir);
      expect(result).toBe(childFile);
    });

    test('should exclude files based on exclusion patterns', () => {
      const parentFile = join(baseDir, 'profiles', 'default', 'standards', 'api.md');
      writeFileSync(parentFile, '# API Standards');
      writeFileSync(
        join(baseDir, 'profiles', 'custom', 'profile-config.yml'),
        `
inherits_from: default
exclude_inherited_files:
  - standards/api.md
`
      );

      const result = getProfileFile('custom', 'standards/api.md', baseDir);
      expect(result).toBeNull();
    });

    test('should return null for nonexistent file', () => {
      const result = getProfileFile('default', 'nonexistent.md', baseDir);
      expect(result).toBeNull();
    });
  });

  describe('getProfileFiles', () => {
    test('should get all files from a directory', () => {
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'frontend.md'), '# Frontend');

      const files = getProfileFiles('default', baseDir, 'standards');
      expect(files).toContain('standards/api.md');
      expect(files).toContain('standards/frontend.md');
    });

    test('should merge files from parent and child profiles', () => {
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');
      writeFileSync(join(baseDir, 'profiles', 'custom', 'standards', 'custom.md'), '# Custom');
      writeFileSync(
        join(baseDir, 'profiles', 'custom', 'profile-config.yml'),
        'inherits_from: default'
      );

      const files = getProfileFiles('custom', baseDir, 'standards');
      expect(files).toContain('standards/api.md');
      expect(files).toContain('standards/custom.md');
    });

    test('should exclude files based on exclusion patterns', () => {
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'frontend.md'), '# Frontend');
      writeFileSync(
        join(baseDir, 'profiles', 'custom', 'profile-config.yml'),
        `
inherits_from: default
exclude_inherited_files:
  - standards/api.md
`
      );

      const files = getProfileFiles('custom', baseDir, 'standards');
      expect(files).not.toContain('standards/api.md');
      expect(files).toContain('standards/frontend.md');
    });
  });
});
