import { existsSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Find .featuremap directory starting from cwd and walking up.
 */
export function findFeaturemapDir(startDir?: string): string | null {
  let current = startDir ?? process.cwd();

  while (current !== dirname(current)) {
    const candidate = join(current, '.featuremap');
    if (existsSync(candidate)) {
      return candidate;
    }
    current = dirname(current);
  }

  return null;
}
