const DERIVED_FILES = [
  'graph.yaml',
  'context/tech-stack.yaml',
  'context/conventions.yaml',
];

const AUTHORED_PATTERNS = [
  'clusters/*.yaml',
  'features/*.yaml',
  'groups/*.yaml',
  'comments/*.yaml',
  'context/decisions.yaml',
  'context/constraints.yaml',
  'context/overview.yaml',
  'context/design-system.yaml',
  'layout.yaml',
];

function normalizePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  return normalized.startsWith('.featuremap/')
    ? normalized.slice('.featuremap/'.length)
    : normalized;
}

function globToRegExp(pattern: string): RegExp {
  let regex = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (char === '*') {
      if (pattern[index + 1] === '*') {
        regex += '.*';
        index += 1;
      } else {
        regex += '[^/]*';
      }
      continue;
    }

    if (/[.+^${}()|[\]\\]/.test(char)) {
      regex += `\\${char}`;
    } else {
      regex += char;
    }
  }

  return new RegExp(`^${regex}$`);
}

const derivedSet = new Set(DERIVED_FILES);
const authoredRegexes = AUTHORED_PATTERNS.map((pattern) => globToRegExp(pattern));

export { DERIVED_FILES, AUTHORED_PATTERNS };

export function isDerivedFile(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  return derivedSet.has(normalized);
}

export function isAuthoredFile(relativePath: string): boolean {
  const normalized = normalizePath(relativePath);
  return authoredRegexes.some((regex) => regex.test(normalized));
}
