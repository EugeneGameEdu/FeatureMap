import { join } from 'path';
import { z } from 'zod';
import { loadContextFile, loadProjectContext } from '../utils/contextLoader.js';
import { loadClusters, loadFeatures } from '../utils/featureLoader.js';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';

const includeEnum = z.enum([
  'techStack',
  'conventions',
  'designSystem',
  'decisions',
  'constraints',
  'overview',
  'all',
]);

const layerEnum = z.enum(['frontend', 'backend', 'shared', 'infra', 'fullstack', 'auto']);

const subjectSchema = z.object({
  type: z.enum(['feature', 'cluster']),
  id: z.string().min(1),
});

type LayerValue = Exclude<z.infer<typeof layerEnum>, 'auto'>;
type SubjectParam = z.infer<typeof subjectSchema>;

function normalizeLayer(value?: string | null): LayerValue | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === 'frontend') return 'frontend';
  if (normalized === 'backend') return 'backend';
  if (normalized === 'shared') return 'shared';
  if (normalized === 'fullstack' || normalized === 'full-stack') return 'fullstack';
  if (normalized === 'infra' || normalized === 'infrastructure') return 'infra';
  return null;
}

function inferLayerFromSubject(subject: SubjectParam | undefined, featuremapDir: string): LayerValue | null {
  if (!subject) return null;

  if (subject.type === 'feature') {
    const features = loadFeatures(join(featuremapDir, 'features'));
    const feature = features.get(subject.id);
    if (!feature) return null;
    return normalizeLayer(feature.scope) ?? normalizeLayer((feature as { layer?: string }).layer);
  }

  const clusters = loadClusters(join(featuremapDir, 'clusters'));
  const cluster = clusters.get(subject.id);
  return normalizeLayer(cluster?.layer);
}

function resolveEffectiveLayer(
  layer: z.infer<typeof layerEnum> | undefined,
  subject: SubjectParam | undefined,
  featuremapDir: string
): LayerValue | null {
  if (layer && layer !== 'auto') {
    return layer;
  }
  if (subject) {
    return inferLayerFromSubject(subject, featuremapDir);
  }
  return null;
}

function loadDesignSystemIfFrontend(
  featuremapDir: string,
  effectiveLayer: LayerValue | null
): Record<string, unknown> | null {
  if (effectiveLayer !== 'frontend') {
    return null;
  }
  return loadContextFile<Record<string, unknown>>(
    join(featuremapDir, 'context'),
    'design-system.yaml'
  );
}

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
- designSystem: design tokens and UI guidelines (frontend only)
- decisions: architectural decisions made by the team (manual)
- constraints: technical/business constraints (manual)
- overview: AI-generated project summary (if exists)

Design system context is only returned for frontend work. Pass layer or subject to improve relevance.`,
  parameters: {
    include: z
      .array(includeEnum)
      .optional()
      .describe('Which context sections to include. Defaults to all.'),
    layer: layerEnum
      .optional()
      .describe('Context layer (frontend/backend/shared/infra/fullstack/auto).'),
    subject: subjectSchema
      .optional()
      .describe('Optional subject for auto layer inference (feature or cluster).'),
  },
  execute: async (params: {
    include?: Array<z.infer<typeof includeEnum>>;
    layer?: z.infer<typeof layerEnum>;
    subject?: SubjectParam;
  }) => {
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

    const include = params.include ?? ['all'];
    const includeAll = include.includes('all');
    const includeDesignSystemExplicit = include.includes('designSystem');
    const effectiveLayer = resolveEffectiveLayer(params.layer, params.subject, featuremapDir);
    const designSystem = loadDesignSystemIfFrontend(featuremapDir, effectiveLayer);
    const includeDesignSystem =
      includeDesignSystemExplicit || (includeAll && effectiveLayer === 'frontend');

    const context = loadProjectContext(featuremapDir);
    const result: Record<string, unknown> = {};

    if (includeAll || include.includes('techStack')) {
      result.techStack = context.techStack;
    }
    if (includeAll || include.includes('conventions')) {
      result.conventions = context.conventions;
    }
    if (includeDesignSystem) {
      result.designSystem = designSystem;
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
        designSystem: designSystem !== null,
        decisions: (context.decisions?.length ?? 0) > 0,
        constraints: (context.constraints?.length ?? 0) > 0,
        overview: context.overview !== null,
      },
      hint: 'Use decisions and constraints for project-specific rules. Pass layer or subject to include frontend design system context.',
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};
