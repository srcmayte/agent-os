/**
 * Filesystem utilities for Agent OS CLI
 * Provides functions for file and directory operations
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { printVerbose } from './output.js';

/**
 * Create a directory if it doesn't exist (unless in dry-run mode)
 * @param dir - Directory path to create
 * @param dryRun - If true, don't actually create the directory
 * @returns The directory path
 */
export function ensureDir(dir: string, dryRun = false): string {
  if (dryRun) {
    if (!existsSync(dir)) {
      printVerbose(`Would create directory: ${dir}`);
    }
    return dir;
  }

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    printVerbose(`Created directory: ${dir}`);
  }

  return dir;
}

/**
 * Copy a file with dry-run support
 * @param source - Source file path
 * @param dest - Destination file path
 * @param dryRun - If true, don't actually copy the file
 * @returns The destination file path
 */
export function copyFile(source: string, dest: string, dryRun = false): string {
  if (dryRun) {
    printVerbose(`Would copy: ${source} -> ${dest}`);
    return dest;
  }

  ensureDir(dirname(dest));
  copyFileSync(source, dest);
  printVerbose(`Copied: ${source} -> ${dest}`);
  return dest;
}

/**
 * Write content to a file with dry-run support
 * @param content - Content to write
 * @param dest - Destination file path
 * @param dryRun - If true, don't actually write the file
 * @returns The destination file path
 */
export function writeFile(content: string, dest: string, dryRun = false): string {
  if (dryRun) {
    printVerbose(`Would write file: ${dest}`);
    return dest;
  }

  ensureDir(dirname(dest));
  writeFileSync(dest, content);
  printVerbose(`Wrote file: ${dest}`);
  return dest;
}

/**
 * Read a file's content
 * @param filePath - Path to the file
 * @returns File content, or null if file doesn't exist
 */
export function readFile(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Check if a file exists
 * @param filePath - Path to check
 * @returns True if file exists
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/**
 * Normalize input to lowercase, replace spaces/underscores with hyphens, remove punctuation
 * @param input - String to normalize
 * @returns Normalized string
 */
export function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ _]/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Check if a path matches any of the exclusion patterns
 * Supports:
 * - Exact matches: 'path/to/file'
 * - Wildcard suffixes: 'path/*' matches 'path/anything'
 * - Wildcard prefixes: '.git*' matches '.git', '.github', '.gitignore'
 * 
 * @param filePath - Path to check
 * @param patterns - Array of exclusion patterns
 * @returns True if the path should be excluded
 */
export function matchesExclusionPattern(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      // Handle wildcard patterns
      const parts = pattern.split('*');
      const prefix = parts[0] || '';
      const suffix = parts[1] || '';
      
      if (prefix && suffix) {
        // Pattern like 'pre*suf' - must start with prefix and end with suffix
        if (filePath.startsWith(prefix) && filePath.endsWith(suffix)) {
          return true;
        }
      } else if (prefix) {
        // Pattern like 'path/*' - must start with prefix
        if (filePath.startsWith(prefix)) {
          return true;
        }
      } else if (suffix) {
        // Pattern like '*suffix' - must end with suffix
        if (filePath.endsWith(suffix)) {
          return true;
        }
      }
    } else if (filePath === pattern) {
      // Exact match
      return true;
    }
  }
  return false;
}
