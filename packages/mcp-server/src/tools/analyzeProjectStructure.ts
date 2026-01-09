import { z } from 'zod';
import * as path from 'path';
import {
  scanProjectStructure,
  formatStructureForAI,
} from '@featuremap/cli/dist/analyzer/structure-scanner.js';

export const analyzeProjectStructureTool = {
  name: 'analyze_project_structure',
  description:
    'Analyzes project folder structure and returns data for generating scan configuration.',
  parameters: {
    projectRoot: z
      .string()
      .optional()
      .describe('Path to project root. Defaults to current directory.'),
  },
  execute: async (params: { projectRoot?: string }) => {
    const root = params.projectRoot ? path.resolve(params.projectRoot) : process.cwd();

    try {
      const structure = await scanProjectStructure(root);
      const formatted = formatStructureForAI(structure);
      const response = [
        'PROJECT STRUCTURE',
        formatted,
        'FEATUREMAP PARSER SUPPORT',
        'Supported (will be parsed and analyzed):',
        '',
        'TypeScript: .ts, .tsx',
        'JavaScript: .js, .jsx',
        'Go: .go (requires go.mod in same or parent folder)',
        '',
        'Not supported (will be ignored):',
        '',
        'Python (.py)',
        'Rust (.rs)',
        'Java (.java)',
        'C/C++ (.c, .cpp, .h)',
        'Ruby (.rb)',
        'PHP (.php)',
        'And other languages',
        '',
        'CONFIG GENERATION INSTRUCTIONS',
        'Based on the structure above, generate a featuremap config.',
        'You must determine:',
        '',
        'INCLUDE PATTERNS - What to scan:',
        '',
        'Look for folders with supported extensions (.ts, .tsx, .js, .jsx, .go)',
        'Typical patterns: "src//.ts", "packages//src//.{ts,tsx}", "**/.go"',
        'Be specific - include only what should be analyzed',
        '',
        '',
        'EXCLUDE PATTERNS - What to skip:',
        '',
        'Always exclude: node_modules, dist, build, vendor',
        'Test files: *.test.ts, *.spec.ts, *_test.go',
        'Type definitions: *.d.ts',
        'Generated code',
        "Legacy folders user probably doesn't want",
        '',
        '',
        'WARNINGS - Issues to mention:',
        '',
        'Unsupported languages in project (Python, Rust, etc.)',
        'Unusual structure that might cause problems',
        'Very large folders that might slow scanning',
        'Mixed concerns (frontend code inside backend folder, etc.)',
        '',
        '',
        'RESPONSE FORMAT',
        'Respond with valid YAML config inside a code block:',
        '',
        'version: 1',
        'project:',
        '  name: "<detected project name>"',
        '  root: "."',
        '',
        'scan:',
        '  include:',
        '    - "<pattern1>"',
        '    - "<pattern2>"',
        '  exclude:',
        '    - "<pattern1>"',
        '    - "<pattern2>"',
        '',
        'features:',
        '  hints: []',
        '```',
        '',
        'After the config, provide:',
        '1. Brief explanation of what you detected',
        '2. Any warnings or recommendations',
        '3. Ask user if they want to adjust anything',
        '```',
      ].join('\n');

      return {
        content: [{ type: 'text' as const, text: response }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
};
