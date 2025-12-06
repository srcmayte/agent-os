/**
 * Shared utilities for base installation commands
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { ensureDir, writeFile, matchesExclusionPattern } from '../../utils/filesystem.js';

// Repository configuration - can be overridden by environment variable
export const REPO_URL =
  process.env.AGENT_OS_REPO_URL || 'https://github.com/srcmayte/agent-os';
export const BASE_DIR = join(homedir(), 'agent-os');

// Files to exclude from installation
export const EXCLUSIONS = ['scripts/base-install.sh', 'old-versions/*', '.git*', '.github/*'];

/**
 * Get the GitHub API URL for the repo tree
 */
export function getRepoApiUrl(): string {
  const match = REPO_URL.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return `https://api.github.com/repos/${match[1]}/${match[2]}/git/trees/main?recursive=true`;
  }
  return 'https://api.github.com/repos/srcmayte/agent-os/git/trees/main?recursive=true';
}

/**
 * Get all files from GitHub repo using the tree API
 */
export async function getRepoFiles(): Promise<string[]> {
  const treeUrl = getRepoApiUrl();

  const response = await fetch(treeUrl);
  if (!response.ok) {
    throw new Error('Failed to fetch repository file list');
  }

  const data = (await response.json()) as { tree: Array<{ path: string; type: string }> };
  const files: string[] = [];

  for (const item of data.tree) {
    if (item.type === 'blob' && !matchesExclusionPattern(item.path, EXCLUSIONS)) {
      files.push(item.path);
    }
  }

  return files;
}

/**
 * Download a file from GitHub
 */
export async function downloadFile(relativePath: string, destPath: string): Promise<boolean> {
  const fileUrl = `${REPO_URL}/raw/main/${relativePath}`;

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) return false;

    const content = await response.text();
    ensureDir(dirname(destPath));
    writeFile(content, destPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Download files from GitHub matching a prefix
 */
export async function downloadFilesFromGitHub(prefix: string): Promise<string[]> {
  const allFiles = await getRepoFiles();
  const matchingFiles = allFiles.filter((f) => f.startsWith(prefix));
  const downloaded: string[] = [];

  for (const file of matchingFiles) {
    const destPath = join(BASE_DIR, file);
    if (await downloadFile(file, destPath)) {
      downloaded.push(file);
    }
  }

  return downloaded;
}

/**
 * Download all files from repository
 */
export async function downloadAllFiles(): Promise<number> {
  const allFiles = await getRepoFiles();
  let count = 0;

  for (const file of allFiles) {
    const destPath = join(BASE_DIR, file);
    if (await downloadFile(file, destPath)) {
      count++;
    }
  }

  return count;
}

/**
 * Get latest version from GitHub
 */
export async function getLatestVersion(): Promise<string> {
  try {
    const configUrl = `${REPO_URL}/raw/main/config.yml`;
    const response = await fetch(configUrl);
    if (!response.ok) return '';

    const content = await response.text();
    const match = content.match(/^version:\s*(.+)$/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}

/**
 * Get current installed version
 */
export function getCurrentVersion(): string {
  const configPath = join(BASE_DIR, 'config.yml');
  if (!existsSync(configPath)) return '';

  try {
    const content = readFileSync(configPath, 'utf-8');
    const match = content.match(/^version:\s*(.+)$/m);
    return match ? match[1].trim() : '';
  } catch {
    return '';
  }
}
