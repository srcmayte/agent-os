/**
 * Output utilities for Agent OS CLI
 * Provides colored console output and logging functions
 */

// ANSI color codes
export const Colors = {
  RED: '\x1b[38;2;255;32;86m',
  GREEN: '\x1b[38;2;0;234;179m',
  YELLOW: '\x1b[38;2;255;185;0m',
  BLUE: '\x1b[38;2;0;208;255m',
  PURPLE: '\x1b[38;2;142;81;255m',
  RESET: '\x1b[0m',
} as const;

// Verbose mode flag
let verbose = false;

/**
 * Set verbose mode
 */
export function setVerbose(enabled: boolean): void {
  verbose = enabled;
}

/**
 * Get verbose mode
 */
export function isVerbose(): boolean {
  return verbose;
}

/**
 * Print text with a specific color
 */
export function printColor(color: string, ...args: unknown[]): void {
  console.log(color + args.join(' ') + Colors.RESET);
}

/**
 * Print a section header
 */
export function printSection(title: string): void {
  console.log('');
  printColor(Colors.BLUE, `=== ${title} ===`);
  console.log('');
}

/**
 * Print a status message
 */
export function printStatus(message: string): void {
  printColor(Colors.BLUE, message);
}

/**
 * Print a success message
 */
export function printSuccess(message: string): void {
  printColor(Colors.GREEN, `✓ ${message}`);
}

/**
 * Print a warning message
 */
export function printWarning(message: string): void {
  printColor(Colors.YELLOW, `⚠️  ${message}`);
}

/**
 * Print an error message
 */
export function printError(message: string): void {
  printColor(Colors.RED, `✗ ${message}`);
}

/**
 * Print a verbose message (only in verbose mode)
 */
export function printVerbose(message: string): void {
  if (verbose) {
    console.error(`[VERBOSE] ${message}`);
  }
}

/**
 * Print a completion message with next steps
 */
export function printCompletion(title: string, steps: string[]): void {
  console.log('');
  printSuccess(title);
  
  if (steps.length > 0) {
    console.log('');
    console.log(`${Colors.GREEN}Next steps:${Colors.RESET}`);
    console.log('');
    steps.forEach((step, index) => {
      console.log(`${Colors.GREEN}${index + 1}) ${step}${Colors.RESET}`);
      console.log('');
    });
  }
}

/**
 * Parse boolean option value
 */
export function parseBool(value: string | boolean | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  return value.toLowerCase() === 'true';
}
