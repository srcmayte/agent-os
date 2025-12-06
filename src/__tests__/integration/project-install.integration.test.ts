import { describe, expect, test, beforeEach, afterEach } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Integration tests for project installation
 * These tests verify the complete installation workflow
 */
describe('Project Install Integration', () => {
  let tempDir: string;
  let baseDir: string;
  let projectDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'agent-os-integration-'));
    baseDir = join(tempDir, 'agent-os');
    projectDir = join(tempDir, 'test-project');

    // Create base installation structure
    mkdirSync(join(baseDir, 'profiles', 'default', 'standards'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'default', 'workflows'), { recursive: true });
    mkdirSync(join(baseDir, 'profiles', 'default', 'commands', 'test-cmd', 'multi-agent'), {
      recursive: true,
    });
    mkdirSync(join(baseDir, 'profiles', 'default', 'agents'), { recursive: true });

    // Create base config
    writeFileSync(
      join(baseDir, 'config.yml'),
      `version: 2.1.1
base_install: true
profile: default
claude_code_commands: true
use_claude_code_subagents: true
agent_os_commands: false
standards_as_claude_code_skills: false
`
    );

    // Create sample standards
    writeFileSync(
      join(baseDir, 'profiles', 'default', 'standards', 'api.md'),
      '# API Standards\n\nThese are the API standards.'
    );
    writeFileSync(
      join(baseDir, 'profiles', 'default', 'standards', 'frontend.md'),
      '# Frontend Standards\n\nThese are the frontend standards.'
    );

    // Create sample workflow
    writeFileSync(
      join(baseDir, 'profiles', 'default', 'workflows', 'implementation.md'),
      '# Implementation Workflow\n\nStep 1: Plan\nStep 2: Build\nStep 3: Test'
    );

    // Create sample command
    writeFileSync(
      join(
        baseDir,
        'profiles',
        'default',
        'commands',
        'test-cmd',
        'multi-agent',
        'test-cmd.md'
      ),
      `# Test Command

{{workflows/implementation}}

Use these standards:
{{standards/*}}
`
    );

    // Create sample agent
    writeFileSync(
      join(baseDir, 'profiles', 'default', 'agents', 'implementer.md'),
      '# Implementer Agent\n\nThis agent implements features.'
    );

    // Create project directory
    mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('should install standards to project', async () => {
    // Import and run the installer directly
    const { installStandards } = await import('../../lib/installer.js');
    const { getEffectiveConfig } = await import('../../lib/config.js');

    const config = getEffectiveConfig({}, baseDir, projectDir);
    const result = installStandards(projectDir, baseDir, config);

    expect(result.success).toBe(true);
    expect(result.files.length).toBe(2);
    expect(existsSync(join(projectDir, 'agent-os', 'standards', 'api.md'))).toBe(true);
    expect(existsSync(join(projectDir, 'agent-os', 'standards', 'frontend.md'))).toBe(true);
  });

  test('should install Claude Code commands with workflow injection', async () => {
    const { installClaudeCodeCommands } = await import('../../lib/installer.js');
    const { getEffectiveConfig } = await import('../../lib/config.js');

    const config = getEffectiveConfig({}, baseDir, projectDir);
    const result = installClaudeCodeCommands(projectDir, baseDir, config);

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);

    const cmdPath = join(projectDir, '.claude', 'commands', 'agent-os', 'test-cmd.md');
    expect(existsSync(cmdPath)).toBe(true);

    // Check that workflow was injected
    const content = readFileSync(cmdPath, 'utf-8');
    expect(content).toContain('Implementation Workflow');
    expect(content).toContain('Step 1: Plan');
  });

  test('should install Claude Code agents', async () => {
    const { installClaudeCodeAgents } = await import('../../lib/installer.js');
    const { getEffectiveConfig } = await import('../../lib/config.js');

    const config = getEffectiveConfig({}, baseDir, projectDir);
    const result = installClaudeCodeAgents(projectDir, baseDir, config);

    expect(result.success).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);

    expect(
      existsSync(join(projectDir, '.claude', 'agents', 'agent-os', 'implementer.md'))
    ).toBe(true);
  });

  test('should write project configuration', async () => {
    const { writeProjectConfig, getEffectiveConfig } = await import('../../lib/config.js');

    mkdirSync(join(projectDir, 'agent-os'), { recursive: true });

    const config = getEffectiveConfig({}, baseDir, projectDir);
    writeProjectConfig(projectDir, config);

    const configPath = join(projectDir, 'agent-os', 'config.yml');
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, 'utf-8');
    expect(content).toContain('version: 2.1.1');
    expect(content).toContain('profile: default');
    expect(content).toContain('claude_code_commands: true');
  });

  test('should process conditionals in templates', async () => {
    const { processConditionals } = await import('../../lib/template.js');

    const content = `Start
{{IF use_claude_code_subagents}}
Subagent content
{{ENDIF use_claude_code_subagents}}
{{UNLESS use_claude_code_subagents}}
Non-subagent content
{{ENDUNLESS use_claude_code_subagents}}
End`;

    // With subagents enabled
    const result1 = processConditionals(content, {
      use_claude_code_subagents: true,
      standards_as_claude_code_skills: false,
      compiled_single_command: false,
    });

    expect(result1).toContain('Start');
    expect(result1).toContain('Subagent content');
    expect(result1).not.toContain('Non-subagent content');
    expect(result1).toContain('End');

    // Without subagents
    const result2 = processConditionals(content, {
      use_claude_code_subagents: false,
      standards_as_claude_code_skills: false,
      compiled_single_command: false,
    });

    expect(result2).toContain('Start');
    expect(result2).not.toContain('Subagent content');
    expect(result2).toContain('Non-subagent content');
    expect(result2).toContain('End');
  });
});
