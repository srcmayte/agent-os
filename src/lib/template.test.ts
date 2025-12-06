import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  processConditionals,
  processWorkflows,
  processStandards,
  compileTemplate,
} from './template.js';

describe('Template processing', () => {
  let tempDir: string;
  let baseDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-test-'));
    baseDir = join(tempDir, 'agent-os');
    mkdirSync(join(baseDir, 'profiles', 'default', 'workflows'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'default', 'standards'), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('processConditionals', () => {
    test('should include content when IF condition is true', () => {
      const content = `Before
{{IF use_claude_code_subagents}}
Subagent content
{{ENDIF use_claude_code_subagents}}
After`;

      const result = processConditionals(content, {
        use_claude_code_subagents: true,
        standards_as_claude_code_skills: false,
        compiled_single_command: false,
      });

      expect(result).toContain('Before');
      expect(result).toContain('Subagent content');
      expect(result).toContain('After');
    });

    test('should exclude content when IF condition is false', () => {
      const content = `Before
{{IF use_claude_code_subagents}}
Subagent content
{{ENDIF use_claude_code_subagents}}
After`;

      const result = processConditionals(content, {
        use_claude_code_subagents: false,
        standards_as_claude_code_skills: false,
        compiled_single_command: false,
      });

      expect(result).toContain('Before');
      expect(result).not.toContain('Subagent content');
      expect(result).toContain('After');
    });

    test('should include content when UNLESS condition is false', () => {
      const content = `Before
{{UNLESS use_claude_code_subagents}}
Non-subagent content
{{ENDUNLESS use_claude_code_subagents}}
After`;

      const result = processConditionals(content, {
        use_claude_code_subagents: false,
        standards_as_claude_code_skills: false,
        compiled_single_command: false,
      });

      expect(result).toContain('Before');
      expect(result).toContain('Non-subagent content');
      expect(result).toContain('After');
    });

    test('should exclude content when UNLESS condition is true', () => {
      const content = `Before
{{UNLESS use_claude_code_subagents}}
Non-subagent content
{{ENDUNLESS use_claude_code_subagents}}
After`;

      const result = processConditionals(content, {
        use_claude_code_subagents: true,
        standards_as_claude_code_skills: false,
        compiled_single_command: false,
      });

      expect(result).toContain('Before');
      expect(result).not.toContain('Non-subagent content');
      expect(result).toContain('After');
    });

    test('should handle nested conditionals', () => {
      const content = `{{IF use_claude_code_subagents}}
Outer
{{IF standards_as_claude_code_skills}}
Inner
{{ENDIF standards_as_claude_code_skills}}
{{ENDIF use_claude_code_subagents}}`;

      const result = processConditionals(content, {
        use_claude_code_subagents: true,
        standards_as_claude_code_skills: true,
        compiled_single_command: false,
      });

      expect(result).toContain('Outer');
      expect(result).toContain('Inner');
    });

    test('should handle nested conditionals when outer is false', () => {
      const content = `{{IF use_claude_code_subagents}}
Outer
{{IF standards_as_claude_code_skills}}
Inner
{{ENDIF standards_as_claude_code_skills}}
{{ENDIF use_claude_code_subagents}}`;

      const result = processConditionals(content, {
        use_claude_code_subagents: false,
        standards_as_claude_code_skills: true,
        compiled_single_command: false,
      });

      expect(result).not.toContain('Outer');
      expect(result).not.toContain('Inner');
    });
  });

  describe('processWorkflows', () => {
    test('should replace workflow references with file content', () => {
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'workflows', 'test-workflow.md'),
        'Workflow content here'
      );

      const content = 'Before {{workflows/test-workflow}} After';
      const result = processWorkflows(content, baseDir, 'default');

      expect(result).toContain('Before');
      expect(result).toContain('Workflow content here');
      expect(result).toContain('After');
    });

    test('should handle missing workflow with warning', () => {
      const content = 'Before {{workflows/missing}} After';
      const result = processWorkflows(content, baseDir, 'default');

      expect(result).toContain('Before');
      expect(result).toContain('⚠️');
      expect(result).toContain('After');
    });

    test('should process nested workflow references', () => {
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'workflows', 'outer.md'),
        'Outer {{workflows/inner}} End'
      );
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'workflows', 'inner.md'),
        'Inner content'
      );

      const content = '{{workflows/outer}}';
      const result = processWorkflows(content, baseDir, 'default');

      expect(result).toContain('Outer');
      expect(result).toContain('Inner content');
      expect(result).toContain('End');
    });
  });

  describe('processStandards', () => {
    test('should expand standards pattern to file list', () => {
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'frontend.md'), '# Frontend');

      const content = '{{standards/*}}';
      const result = processStandards(content, baseDir, 'default');

      expect(result).toContain('@agent-os/standards/api.md');
      expect(result).toContain('@agent-os/standards/frontend.md');
    });

    test('should handle specific standard file reference', () => {
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');

      const content = '{{standards/api}}';
      const result = processStandards(content, baseDir, 'default');

      expect(result).toContain('@agent-os/standards/api.md');
    });
  });

  describe('compileTemplate', () => {
    test('should process all template features together', () => {
      writeFileSync(
        join(baseDir, 'profiles', 'default', 'workflows', 'test.md'),
        'Workflow content'
      );
      writeFileSync(join(baseDir, 'profiles', 'default', 'standards', 'api.md'), '# API');

      const content = `Header
{{IF use_claude_code_subagents}}
Use subagents
{{ENDIF use_claude_code_subagents}}
{{workflows/test}}
{{standards/api}}
Footer`;

      const result = compileTemplate(
        content,
        baseDir,
        'default',
        {
          use_claude_code_subagents: true,
          standards_as_claude_code_skills: false,
          compiled_single_command: false,
        }
      );

      expect(result).toContain('Header');
      expect(result).toContain('Use subagents');
      expect(result).toContain('Workflow content');
      expect(result).toContain('@agent-os/standards/api.md');
      expect(result).toContain('Footer');
    });
  });
});
