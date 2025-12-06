/**
 * Profile management for Agent OS CLI
 * Handles profile loading, inheritance, and file resolution
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import type { ProfileConfig } from '../types/index.js';
import { parseYamlFile } from '../utils/yaml.js';
import { printVerbose } from '../utils/output.js';

/**
 * Load profile configuration
 */
export function loadProfileConfig(baseDir: string, profile: string): ProfileConfig | null {
  const profileDir = join(baseDir, 'profiles', profile);

  if (!existsSync(profileDir)) {
    return null;
  }

  const configPath = join(profileDir, 'profile-config.yml');

  if (!existsSync(configPath)) {
    // Profile exists but no config file - return defaults
    return {
      inherits_from: undefined,
      exclude_inherited_files: [],
    };
  }

  const data = parseYamlFile<Partial<ProfileConfig>>(configPath);

  if (!data) {
    return {
      inherits_from: undefined,
      exclude_inherited_files: [],
    };
  }

  return {
    inherits_from: data.inherits_from === false ? undefined : String(data.inherits_from || ''),
    exclude_inherited_files: Array.isArray(data.exclude_inherited_files)
      ? data.exclude_inherited_files.map(String)
      : [],
  };
}

/**
 * Match a file path against a pattern (supports wildcards)
 */
export function matchPattern(path: string, pattern: string): boolean {
  // Convert pattern to regex
  // * matches anything except /
  // ** matches anything including /
  const regexPattern = pattern
    .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLESTAR>>>/g, '.*');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Check if a file should be excluded based on patterns
 */
function shouldExclude(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchPattern(filePath, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Get a file from profile considering inheritance
 * Returns the full path to the file, or null if not found
 */
export function getProfileFile(
  profile: string,
  filePath: string,
  baseDir: string
): string | null {
  const visitedProfiles = new Set<string>();
  let currentProfile = profile;
  let exclusionPatterns: string[] = [];

  while (currentProfile) {
    // Check for circular inheritance
    if (visitedProfiles.has(currentProfile)) {
      printVerbose(`Circular inheritance detected at profile: ${currentProfile}`);
      return null;
    }
    visitedProfiles.add(currentProfile);

    const profileDir = join(baseDir, 'profiles', currentProfile);
    const fullPath = join(profileDir, filePath);
    const config = loadProfileConfig(baseDir, currentProfile);

    // Collect exclusion patterns
    if (config?.exclude_inherited_files) {
      exclusionPatterns = [...exclusionPatterns, ...config.exclude_inherited_files];
    }

    // Check if file exists and is not excluded
    if (existsSync(fullPath)) {
      // Check exclusions
      if (shouldExclude(filePath, exclusionPatterns)) {
        return null;
      }
      return fullPath;
    }

    // Check for parent profile
    if (!config || !config.inherits_from) {
      return null;
    }

    currentProfile = config.inherits_from;
  }

  return null;
}

/**
 * Get all files from a profile directory considering inheritance
 */
export function getProfileFiles(profile: string, baseDir: string, subdir?: string): string[] {
  const allFiles = new Map<string, string>(); // relativePath -> fullPath
  const exclusionPatterns: string[] = [];
  const profilesToProcess: string[] = [];
  const visitedProfiles = new Set<string>();

  // Collect all profiles in inheritance chain (from child to root)
  let currentProfile = profile;
  while (currentProfile) {
    if (visitedProfiles.has(currentProfile)) {
      break;
    }
    visitedProfiles.add(currentProfile);
    profilesToProcess.unshift(currentProfile); // Add to front so root is first

    const config = loadProfileConfig(baseDir, currentProfile);
    if (config?.exclude_inherited_files) {
      exclusionPatterns.push(...config.exclude_inherited_files);
    }

    if (!config || !config.inherits_from) {
      break;
    }
    currentProfile = config.inherits_from;
  }

  // Process profiles from root to child (so child overrides parent)
  for (const proc of profilesToProcess) {
    const profileDir = join(baseDir, 'profiles', proc);
    const searchDir = subdir ? join(profileDir, subdir) : profileDir;

    if (!existsSync(searchDir)) {
      continue;
    }

    // Find all files recursively
    const files = findFilesRecursive(searchDir, ['.md', '.yml', '.yaml']);

    for (const file of files) {
      const relativePath = relative(profileDir, file);

      // Check if excluded
      if (shouldExclude(relativePath, exclusionPatterns)) {
        continue;
      }

      allFiles.set(relativePath, file);
    }
  }

  return Array.from(allFiles.keys()).sort();
}

/**
 * Find files recursively with specific extensions
 */
function findFilesRecursive(dir: string, extensions: string[]): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...findFilesRecursive(fullPath, extensions));
    } else if (stat.isFile()) {
      const hasValidExtension = extensions.some((ext) => entry.endsWith(ext));
      if (hasValidExtension) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Get list of available profiles
 */
export function getAvailableProfiles(baseDir: string): string[] {
  const profilesDir = join(baseDir, 'profiles');

  if (!existsSync(profilesDir)) {
    return [];
  }

  const entries = readdirSync(profilesDir);
  const profiles: string[] = [];

  for (const entry of entries) {
    const fullPath = join(profilesDir, entry);
    if (statSync(fullPath).isDirectory()) {
      profiles.push(entry);
    }
  }

  return profiles.sort();
}
