/**
 * Template processing for Agent OS CLI
 * Handles conditionals, workflow injection, and standards expansion
 */

import { readFileSync, existsSync } from 'fs';
import { getProfileFile, getProfileFiles } from './profile.js';
import { printVerbose, printWarning } from '../utils/output.js';

/**
 * Conditional context for template processing
 */
export interface ConditionalContext {
  use_claude_code_subagents: boolean;
  standards_as_claude_code_skills: boolean;
  compiled_single_command: boolean;
}

/**
 * Process conditional tags ({{IF}}, {{UNLESS}}, {{ENDIF}}, {{ENDUNLESS}})
 */
export function processConditionals(content: string, context: ConditionalContext): string {
  const lines = content.split('\n');
  const result: string[] = [];
  const shouldIncludeStack: boolean[] = [true]; // Stack to handle nesting

  for (const line of lines) {
    // Check for IF tags
    const ifMatch = line.match(/\{\{IF\s+(\w+)\}\}/);
    if (ifMatch) {
      const flagName = ifMatch[1];
      const conditionMet = evaluateCondition(flagName, context);
      const parentInclude = shouldIncludeStack[shouldIncludeStack.length - 1];
      shouldIncludeStack.push(parentInclude && conditionMet);
      continue;
    }

    // Check for UNLESS tags
    const unlessMatch = line.match(/\{\{UNLESS\s+(\w+)\}\}/);
    if (unlessMatch) {
      const flagName = unlessMatch[1];
      const conditionMet = !evaluateCondition(flagName, context);
      const parentInclude = shouldIncludeStack[shouldIncludeStack.length - 1];
      shouldIncludeStack.push(parentInclude && conditionMet);
      continue;
    }

    // Check for ENDIF tags
    if (line.match(/\{\{ENDIF\s+\w+\}\}/)) {
      if (shouldIncludeStack.length > 1) {
        shouldIncludeStack.pop();
      }
      continue;
    }

    // Check for ENDUNLESS tags
    if (line.match(/\{\{ENDUNLESS\s+\w+\}\}/)) {
      if (shouldIncludeStack.length > 1) {
        shouldIncludeStack.pop();
      }
      continue;
    }

    // Include line if current context allows
    if (shouldIncludeStack[shouldIncludeStack.length - 1]) {
      result.push(line);
    }
  }

  // Check for unclosed conditionals
  if (shouldIncludeStack.length > 1) {
    printWarning(`Unclosed conditional block detected (nesting level: ${shouldIncludeStack.length - 1})`);
  }

  return result.join('\n');
}

/**
 * Evaluate a condition flag
 */
function evaluateCondition(flagName: string, context: ConditionalContext): boolean {
  switch (flagName) {
    case 'use_claude_code_subagents':
      return context.use_claude_code_subagents;
    case 'standards_as_claude_code_skills':
      return context.standards_as_claude_code_skills;
    case 'compiled_single_command':
      return context.compiled_single_command;
    default:
      printWarning(`Unknown conditional flag: ${flagName}`);
      return false;
  }
}

/**
 * Process workflow references {{workflows/path}}
 */
export function processWorkflows(
  content: string,
  baseDir: string,
  profile: string,
  processedFiles: Set<string> = new Set()
): string {
  // Find all workflow references
  const workflowRefs = content.match(/\{\{workflows\/[^}]+\}\}/g) || [];
  const uniqueRefs = [...new Set(workflowRefs)];

  let result = content;

  for (const ref of uniqueRefs) {
    // Extract workflow path: {{workflows/test}} -> test
    const workflowPath = ref.replace(/^\{\{workflows\//, '').replace(/\}\}$/, '');

    // Check for circular reference
    if (processedFiles.has(workflowPath)) {
      printWarning(`Circular workflow reference detected: ${workflowPath}`);
      continue;
    }

    // Get workflow file
    const workflowFile = getProfileFile(profile, `workflows/${workflowPath}.md`, baseDir);

    if (workflowFile && existsSync(workflowFile)) {
      let workflowContent = readFileSync(workflowFile, 'utf-8');

      // Recursively process nested workflows
      const newProcessedFiles = new Set(processedFiles);
      newProcessedFiles.add(workflowPath);
      workflowContent = processWorkflows(workflowContent, baseDir, profile, newProcessedFiles);

      // Replace reference with content
      result = result.replace(ref, workflowContent);
      printVerbose(`Injected workflow: ${workflowPath}`);
    } else {
      // Add warning inline
      const warningMsg = `⚠️ This workflow file was not found in your Agent OS base installation at ~/agent-os/profiles/${profile}/workflows/${workflowPath}.md`;
      result = result.replace(ref, `${ref}\n${warningMsg}`);
      printVerbose(`Workflow not found: ${workflowPath}`);
    }
  }

  return result;
}

/**
 * Process standards references {{standards/pattern}}
 */
export function processStandards(
  content: string,
  baseDir: string,
  profile: string
): string {
  // Find all standards references
  const standardsRefs = content.match(/\{\{standards\/[^}]+\}\}/g) || [];
  const uniqueRefs = [...new Set(standardsRefs)];

  let result = content;

  for (const ref of uniqueRefs) {
    // Extract standards pattern: {{standards/backend/*}} -> backend/*
    const pattern = ref.replace(/^\{\{standards\//, '').replace(/\}\}$/, '');
    const standardsList = expandStandardsPattern(pattern, baseDir, profile);

    // Replace reference with expanded list
    result = result.replace(ref, standardsList.join('\n'));
  }

  return result;
}

/**
 * Expand a standards pattern to a list of file references
 */
function expandStandardsPattern(pattern: string, baseDir: string, profile: string): string[] {
  const results: string[] = [];

  if (pattern.includes('*')) {
    // Wildcard pattern - find all matching files
    const basePath = pattern.replace(/\*.*$/, '');
    const files = getProfileFiles(profile, baseDir, `standards/${basePath}`);

    for (const file of files) {
      if (file.endsWith('.md')) {
        results.push(`@agent-os/${file}`);
      }
    }
  } else {
    // Specific file reference
    const filePath = `standards/${pattern}.md`;
    const fullFile = getProfileFile(profile, filePath, baseDir);

    if (fullFile && existsSync(fullFile)) {
      results.push(`@agent-os/${filePath}`);
    }
  }

  return results.sort();
}

/**
 * Compile a template with all processing
 */
export function compileTemplate(
  content: string,
  baseDir: string,
  profile: string,
  context: ConditionalContext
): string {
  // 1. Process conditionals first
  let result = processConditionals(content, context);

  // 2. Process workflow injections
  result = processWorkflows(result, baseDir, profile);

  // 3. Process standards expansions
  result = processStandards(result, baseDir, profile);

  return result;
}

/**
 * Replace Playwright tool name with expanded tool list
 */
export function replacePlaywrightTools(toolsLine: string): string {
  const playwrightTools = [
    'mcp__playwright__browser_close',
    'mcp__playwright__browser_console_messages',
    'mcp__playwright__browser_handle_dialog',
    'mcp__playwright__browser_evaluate',
    'mcp__playwright__browser_file_upload',
    'mcp__playwright__browser_fill_form',
    'mcp__playwright__browser_install',
    'mcp__playwright__browser_press_key',
    'mcp__playwright__browser_type',
    'mcp__playwright__browser_navigate',
    'mcp__playwright__browser_navigate_back',
    'mcp__playwright__browser_network_requests',
    'mcp__playwright__browser_take_screenshot',
    'mcp__playwright__browser_snapshot',
    'mcp__playwright__browser_click',
    'mcp__playwright__browser_drag',
    'mcp__playwright__browser_hover',
    'mcp__playwright__browser_select_option',
    'mcp__playwright__browser_tabs',
    'mcp__playwright__browser_wait_for',
    'mcp__ide__getDiagnostics',
    'mcp__ide__executeCode',
    'mcp__playwright__browser_resize',
  ].join(', ');

  return toolsLine.replace(/Playwright/g, playwrightTools);
}
