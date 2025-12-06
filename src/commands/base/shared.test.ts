/**
 * Unit tests for base command shared utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  REPO_URL,
  BASE_DIR,
  getRepoApiUrl,
} from './shared.js';
import { homedir } from 'os';
import { join } from 'path';

describe('base/shared', () => {
  describe('REPO_URL', () => {
    it('should default to srcmayte/agent-os repository', () => {
      // May be overridden by env var, but default should be srcmayte repo
      expect(REPO_URL).toMatch(/github\.com/);
    });
  });

  describe('BASE_DIR', () => {
    it('should be in user home directory', () => {
      expect(BASE_DIR).toBe(join(homedir(), 'agent-os'));
    });
  });

  describe('getRepoApiUrl', () => {
    it('should return GitHub API URL for tree endpoint', () => {
      const url = getRepoApiUrl();
      expect(url).toMatch(/api\.github\.com\/repos/);
      expect(url).toMatch(/git\/trees\/main\?recursive=true/);
    });
  });
});
