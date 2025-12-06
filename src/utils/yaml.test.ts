import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getYamlValue, getYamlArray, parseYamlFile } from './yaml.js';

describe('YAML utilities', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getYamlValue', () => {
    test('should get a simple string value', () => {
      const configPath = join(tempDir, 'config.yml');
      writeFileSync(
        configPath,
        `
version: 2.1.1
profile: default
`
      );
      expect(getYamlValue(configPath, 'version', '')).toBe('2.1.1');
      expect(getYamlValue(configPath, 'profile', '')).toBe('default');
    });

    test('should get a boolean value', () => {
      const configPath = join(tempDir, 'config.yml');
      writeFileSync(
        configPath,
        `
claude_code_commands: true
agent_os_commands: false
`
      );
      expect(getYamlValue(configPath, 'claude_code_commands', '')).toBe('true');
      expect(getYamlValue(configPath, 'agent_os_commands', '')).toBe('false');
    });

    test('should return default when key not found', () => {
      const configPath = join(tempDir, 'config.yml');
      writeFileSync(configPath, 'version: 2.1.1\n');
      expect(getYamlValue(configPath, 'nonexistent', 'default')).toBe('default');
    });

    test('should return default when file does not exist', () => {
      expect(getYamlValue('/nonexistent/path.yml', 'key', 'default')).toBe('default');
    });

    test('should handle quoted values', () => {
      const configPath = join(tempDir, 'config.yml');
      writeFileSync(
        configPath,
        `
name: "quoted value"
single: 'single quoted'
`
      );
      expect(getYamlValue(configPath, 'name', '')).toBe('quoted value');
      expect(getYamlValue(configPath, 'single', '')).toBe('single quoted');
    });
  });

  describe('getYamlArray', () => {
    test('should get array values', () => {
      const configPath = join(tempDir, 'config.yml');
      writeFileSync(
        configPath,
        `
exclude_inherited_files:
  - standards/backend/api/*
  - standards/backend/database/migrations.md
`
      );
      const result = getYamlArray(configPath, 'exclude_inherited_files');
      expect(result).toEqual([
        'standards/backend/api/*',
        'standards/backend/database/migrations.md',
      ]);
    });

    test('should return empty array when key not found', () => {
      const configPath = join(tempDir, 'config.yml');
      writeFileSync(configPath, 'version: 2.1.1\n');
      expect(getYamlArray(configPath, 'nonexistent')).toEqual([]);
    });

    test('should return empty array when file does not exist', () => {
      expect(getYamlArray('/nonexistent/path.yml', 'key')).toEqual([]);
    });
  });

  describe('parseYamlFile', () => {
    test('should parse a complete YAML file', () => {
      const configPath = join(tempDir, 'config.yml');
      writeFileSync(
        configPath,
        `
version: 2.1.1
profile: default
claude_code_commands: true
exclude_inherited_files:
  - file1.md
  - file2.md
`
      );
      const result = parseYamlFile(configPath);
      expect(result).toEqual({
        version: '2.1.1',
        profile: 'default',
        claude_code_commands: true,
        exclude_inherited_files: ['file1.md', 'file2.md'],
      });
    });

    test('should return null when file does not exist', () => {
      expect(parseYamlFile('/nonexistent/path.yml')).toBeNull();
    });
  });
});
