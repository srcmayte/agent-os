import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { displayConfiguration } from './shared.js';

describe('Project shared utilities', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('displayConfiguration', () => {
    test('should display configuration values', () => {
      displayConfiguration({
        profile: 'default',
        claude_code_commands: true,
        use_claude_code_subagents: false,
        agent_os_commands: true,
      });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('Profile');
      expect(output).toContain('default');
      expect(output).toContain('Claude Code Commands');
    });

    test('should display all config options', () => {
      displayConfiguration({
        profile: 'custom-profile',
        claude_code_commands: false,
        use_claude_code_subagents: true,
        agent_os_commands: false,
      });

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('custom-profile');
      expect(output).toContain('Subagents');
      expect(output).toContain('Agent OS Commands');
    });
  });
});
