import { z } from 'zod';
import { loadProjectContext } from '../utils/contextLoader.js';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';

const includeEnum = z.enum([
  'techStack',
  'conventions',
  'decisions',
  'constraints',
  'overview',
  'all',
]);

export const getProjectContextTool = {
  name: 'get_project_context',
  description: `Get project context including tech stack, conventions, architectural decisions, and constraints.

Use this tool to understand the project before:
- Grouping clusters into features
- Making architectural recommendations
- Understanding why certain decisions were made

Returns structured information about:
- techStack: frameworks, build tools, project structure (monorepo/single)
- conventions: naming patterns, file organization, import style
- decisions: architectural decisions made by the team (manual)
- constraints: technical/business constraints (manual)
- overview: AI-generated project summary (if exists)`,
  parameters: {
    include: z
      .array(includeEnum)
      .optional()
      .describe('Which context sections to include. Defaults to all.'),
  },
  execute: async (params: { include?: Array<z.infer<typeof includeEnum>> }) => {
    const featuremapDir = findFeaturemapDir();
    if (!featuremapDir) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Error: No .featuremap directory found. Run "featuremap init" first.',
          },
        ],
        isError: true,
      };
    }

    const context = loadProjectContext(featuremapDir);
    const include = params.include ?? ['all'];
    const includeAll = include.includes('all');

    const result: Record<string, unknown> = {};

    if (includeAll || include.includes('techStack')) {
      result.techStack = context.techStack;
    }
    if (includeAll || include.includes('conventions')) {
      result.conventions = context.conventions;
    }
    if (includeAll || include.includes('decisions')) {
      result.decisions = context.decisions;
    }
    if (includeAll || include.includes('constraints')) {
      result.constraints = context.constraints;
    }
    if (includeAll || include.includes('overview')) {
      result.overview = context.overview;
    }

    result._meta = {
      availableSections: {
        techStack: context.techStack !== null,
        conventions: context.conventions !== null,
        decisions: (context.decisions?.length ?? 0) > 0,
        constraints: (context.constraints?.length ?? 0) > 0,
        overview: context.overview !== null,
      },
      hint: 'Use decisions and constraints to understand project-specific rules when making recommendations.',
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
