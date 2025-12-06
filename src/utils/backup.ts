/**
 * Backup utilities for Agent OS CLI
 * Provides functions for managing installation backups
 */

import { existsSync, rmSync, cpSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { homedir } from 'os';
import { printSuccess, printVerbose } from './output.js';

/** Default maximum number of backups to keep */
const DEFAULT_MAX_BACKUPS = 10;

/** Get the maximum number of backups from environment or use default */
function getMaxBackups(): number {
  const envValue = process.env.AGENT_OS_MAX_BACKUPS;
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MAX_BACKUPS;
}

/**
 * Generate a timestamp string for backup directory naming
 * Format: YYYYMMDD-HHMMSS
 */
function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Get list of existing backup directories sorted by creation time (oldest first)
 */
function getExistingBackups(baseDir: string): string[] {
  const parentDir = join(homedir());
  const baseName = basename(baseDir);
  const backupPrefix = `${baseName}.backup-`;

  if (!existsSync(parentDir)) {
    return [];
  }

  const entries = readdirSync(parentDir);
  const backups: { path: string; time: number }[] = [];

  for (const entry of entries) {
    if (entry.startsWith(backupPrefix) || entry === `${baseName}.backup`) {
      const fullPath = join(parentDir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          backups.push({ path: fullPath, time: stat.mtimeMs });
        }
      } catch {
        // Ignore errors
      }
    }
  }

  // Sort by modification time (oldest first)
  backups.sort((a, b) => a.time - b.time);
  return backups.map((b) => b.path);
}

/**
 * Purge old backups, keeping only the most recent maxBackups
 */
function purgeOldBackups(baseDir: string, maxBackups: number): void {
  const existingBackups = getExistingBackups(baseDir);
  
  // We need to delete the oldest ones if we have too many
  // After creating a new backup, we'll have existingBackups.length + 1
  // So we need to keep maxBackups - 1 old ones
  const toDelete = existingBackups.slice(0, Math.max(0, existingBackups.length - maxBackups + 1));

  for (const backupPath of toDelete) {
    printVerbose(`Removing old backup: ${backupPath}`);
    rmSync(backupPath, { recursive: true, force: true });
  }
}

/**
 * Create a timestamped backup of the installation directory
 * Automatically manages the maximum number of backups
 * 
 * @param sourceDir - The directory to backup (e.g., ~/agent-os)
 * @returns The path to the created backup directory
 */
export function createTimestampedBackup(sourceDir: string): string {
  if (!existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  const maxBackups = getMaxBackups();
  const timestamp = generateTimestamp();
  const baseName = basename(sourceDir);
  const parentDir = join(homedir());
  const backupDir = join(parentDir, `${baseName}.backup-${timestamp}`);

  // Purge old backups before creating new one
  purgeOldBackups(sourceDir, maxBackups);

  // Create the backup
  cpSync(sourceDir, backupDir, { recursive: true });
  printSuccess(`Backed up to ~/${baseName}.backup-${timestamp}`);

  return backupDir;
}

/**
 * Get the number of existing backups
 */
export function getBackupCount(baseDir: string): number {
  return getExistingBackups(baseDir).length;
}

/**
 * Get the default max backups value (for testing/display)
 */
export function getDefaultMaxBackups(): number {
  return DEFAULT_MAX_BACKUPS;
}
