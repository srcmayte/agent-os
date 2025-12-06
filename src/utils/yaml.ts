/**
 * YAML parsing utilities for Agent OS CLI
 * Provides functions to read and parse YAML configuration files
 */

import { readFileSync, existsSync } from 'fs';
import { parse } from 'yaml';

/**
 * Get a simple value from a YAML file
 * @param filePath - Path to the YAML file
 * @param key - Key to look up
 * @param defaultValue - Default value if key not found
 * @returns The value as a string, or default if not found
 */
export function getYamlValue(filePath: string, key: string, defaultValue: string): string {
  try {
    if (!existsSync(filePath)) {
      return defaultValue;
    }

    const content = readFileSync(filePath, 'utf-8');
    const data = parse(content);

    if (data && typeof data === 'object' && key in data) {
      const value = data[key];
      if (typeof value === 'string') {
        // Remove quotes if present
        return value.replace(/^["']|["']$/g, '');
      }
      return String(value);
    }

    return defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Get array values from a YAML file
 * @param filePath - Path to the YAML file
 * @param key - Key to look up
 * @returns Array of values, or empty array if not found
 */
export function getYamlArray(filePath: string, key: string): string[] {
  try {
    if (!existsSync(filePath)) {
      return [];
    }

    const content = readFileSync(filePath, 'utf-8');
    const data = parse(content);

    if (data && typeof data === 'object' && key in data) {
      const value = data[key];
      if (Array.isArray(value)) {
        return value.map((item) => String(item));
      }
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Parse a complete YAML file
 * @param filePath - Path to the YAML file
 * @returns Parsed object, or null if file doesn't exist or is invalid
 */
export function parseYamlFile<T = Record<string, unknown>>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    const content = readFileSync(filePath, 'utf-8');
    return parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Type guard to check if value is a record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
