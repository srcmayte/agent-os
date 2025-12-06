import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import {
  printColor,
  printSection,
  printStatus,
  printSuccess,
  printWarning,
  printError,
  printVerbose,
  printCompletion,
  parseBool,
  setVerbose,
} from './output.js';

describe('Output utilities', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>;
  let stderrSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    stderrSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setVerbose(false);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  describe('printColor', () => {
    test('should print text with color code', () => {
      printColor('\x1b[36m', 'test message');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('test message');
    });
  });

  describe('printSection', () => {
    test('should print section header with formatting', () => {
      printSection('Test Section');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('Test Section');
      expect(output).toContain('===');
    });
  });

  describe('printStatus', () => {
    test('should print status message', () => {
      printStatus('Status message');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('Status message');
    });
  });

  describe('printSuccess', () => {
    test('should print success message with checkmark', () => {
      printSuccess('Operation completed');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('✓');
      expect(output).toContain('Operation completed');
    });
  });

  describe('printWarning', () => {
    test('should print warning message', () => {
      printWarning('Warning message');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('⚠️');
      expect(output).toContain('Warning message');
    });
  });

  describe('printError', () => {
    test('should print error message with X', () => {
      printError('Error message');
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('✗');
      expect(output).toContain('Error message');
    });
  });

  describe('printVerbose', () => {
    test('should not print when verbose is disabled', () => {
      setVerbose(false);
      printVerbose('Verbose message');
      expect(stderrSpy).not.toHaveBeenCalled();
    });

    test('should print when verbose is enabled', () => {
      setVerbose(true);
      printVerbose('Verbose message');
      expect(stderrSpy).toHaveBeenCalled();
      const output = stderrSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[VERBOSE]');
      expect(output).toContain('Verbose message');
    });
  });

  describe('printCompletion', () => {
    test('should print completion message with steps', () => {
      printCompletion('Task completed!', ['Step 1', 'Step 2']);
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('✓');
      expect(output).toContain('Task completed!');
      expect(output).toContain('Next steps:');
      expect(output).toContain('1)');
      expect(output).toContain('2)');
    });

    test('should handle empty steps without showing Next steps header', () => {
      printCompletion('Done!', []);
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((c) => c[0]).join('');
      expect(output).toContain('✓');
      expect(output).toContain('Done!');
      expect(output).not.toContain('Next steps:');
    });
  });

  describe('parseBool', () => {
    test('should return undefined for undefined input', () => {
      expect(parseBool(undefined)).toBeUndefined();
    });

    test('should return boolean unchanged', () => {
      expect(parseBool(true)).toBe(true);
      expect(parseBool(false)).toBe(false);
    });

    test('should parse string "true" as true', () => {
      expect(parseBool('true')).toBe(true);
      expect(parseBool('TRUE')).toBe(true);
      expect(parseBool('True')).toBe(true);
    });

    test('should parse other strings as false', () => {
      expect(parseBool('false')).toBe(false);
      expect(parseBool('yes')).toBe(false);
      expect(parseBool('no')).toBe(false);
      expect(parseBool('')).toBe(false);
    });
  });
});
