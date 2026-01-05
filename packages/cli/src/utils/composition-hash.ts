import { createHash } from 'crypto';

/**
 * Generate a stable hash from a list of file paths.
 * Used to detect when cluster composition changes.
 */
export function generateCompositionHash(files: string[]): string {
  const sorted = [...files].sort((a, b) => a.localeCompare(b));
  const content = sorted.join('\n');

  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Check if composition changed between old and new file lists.
 */
export function hasCompositionChanged(oldHash: string | undefined, newFiles: string[]): boolean {
  if (!oldHash) {
    return true;
  }

  const newHash = generateCompositionHash(newFiles);
  return oldHash !== newHash;
}
