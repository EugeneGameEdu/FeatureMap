export type DependencySource = 'npm' | 'go';

interface PatternRule {
  pattern: string;
  category: string | null;
}

const SCOPE_PATTERNS: PatternRule[] = [
  { pattern: '@radix-ui/*', category: 'UI Components' },
  { pattern: '@xyflow/*', category: 'Visualization' },
  { pattern: '@modelcontextprotocol/*', category: 'AI Integration' },
  { pattern: '@testing-library/*', category: 'Testing' },
  { pattern: '@types/*', category: null },
];

const SUFFIX_PATTERNS: PatternRule[] = [
  { pattern: '*-icons', category: 'Icons' },
  { pattern: 'lucide-*', category: 'Icons' },
  { pattern: 'eslint-*', category: 'Linting' },
  { pattern: 'vite-*', category: 'Build Tools' },
];

const EXACT_CATEGORIES: Record<string, string> = {
  react: 'UI Framework',
  'react-dom': 'UI Framework',
  'react-router': 'UI Framework',
  'react-router-dom': 'UI Framework',
  express: 'Web Server',
  fastify: 'Web Server',
  koa: 'Web Server',
  zod: 'Validation',
  commander: 'CLI',
  tailwindcss: 'Styling',
  'tailwind-merge': 'Styling',
  'ts-morph': 'Code Analysis',
  chokidar: 'File Watching',
  yaml: 'Data Parsing',
  vite: 'Build Tools',
  webpack: 'Build Tools',
  rollup: 'Build Tools',
  esbuild: 'Build Tools',
  tsup: 'Build Tools',
  typescript: 'Build Tools',
  eslint: 'Linting',
  prettier: 'Linting',
  postcss: 'Build Tools',
  'lucide-react': 'Icons',
};

const GO_PATH_PATTERNS: PatternRule[] = [
  { pattern: 'github.com/gin-gonic/*', category: 'Web Framework' },
  { pattern: 'github.com/gorilla/*', category: 'Web Utilities' },
  { pattern: 'github.com/spf13/cobra', category: 'CLI' },
  { pattern: 'gorm.io/gorm', category: 'Database ORM' },
];

const UNIVERSAL_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  {
    category: 'Testing',
    keywords: ['test', 'spec', 'jest', 'mocha', 'vitest', 'cypress', 'playwright'],
  },
  {
    category: 'Build Tools',
    keywords: ['build', 'compile', 'webpack', 'rollup', 'vite', 'esbuild', 'tsup'],
  },
  {
    category: 'CLI',
    keywords: ['cli', 'command'],
  },
];

function normalize(value: string): string {
  return value.toLowerCase();
}

function matchPattern(value: string, pattern: string): boolean {
  if (!pattern.includes('*')) {
    return value === pattern;
  }

  const [prefix, suffix] = pattern.split('*');
  if (prefix && !value.startsWith(prefix)) {
    return false;
  }
  if (suffix && !value.endsWith(suffix)) {
    return false;
  }
  return true;
}

function matchPatternList(name: string, patterns: PatternRule[]): string | null | undefined {
  const normalized = normalize(name);
  for (const rule of patterns) {
    if (matchPattern(normalized, normalize(rule.pattern))) {
      return rule.category;
    }
  }
  return undefined;
}

function matchExact(name: string): string | undefined {
  const normalized = normalize(name);
  return EXACT_CATEGORIES[normalized];
}

function matchUniversalKeywords(name: string): string | undefined {
  const normalized = normalize(name);
  for (const rule of UNIVERSAL_KEYWORDS) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }
  return undefined;
}

export function categorizeDependency(name: string, source: DependencySource): string | null {
  if (source === 'go') {
    const goCategory = matchPatternList(name, GO_PATH_PATTERNS);
    if (goCategory !== undefined) {
      return goCategory;
    }
    return 'Other';
  }

  const scopeCategory = matchPatternList(name, SCOPE_PATTERNS);
  if (scopeCategory !== undefined) {
    return scopeCategory;
  }

  const exactCategory = matchExact(name);
  if (exactCategory) {
    return exactCategory;
  }

  const suffixCategory = matchPatternList(name, SUFFIX_PATTERNS);
  if (suffixCategory !== undefined) {
    return suffixCategory;
  }

  const universalCategory = matchUniversalKeywords(name);
  if (universalCategory) {
    return universalCategory;
  }

  return 'Other';
}
