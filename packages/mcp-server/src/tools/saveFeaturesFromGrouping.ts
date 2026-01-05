import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import type { FeatureInput } from '../types/feature.js';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { loadClusters, loadFeatures } from '../utils/featureLoader.js';
import { findDuplicateIds, normalizeStringList } from '../utils/listUtils.js';
import { mergeFeatureWithLocks, markFeatureIgnored } from '../utils/featureMerge.js';
import { writeFeatureYaml } from '../utils/featureYaml.js';
import { buildGraphData, writeGraphYaml } from '../utils/graphBuilder.js';

const scopeEnum = z.enum(['frontend', 'backend', 'fullstack', 'shared']);
const statusEnum = z.enum(['active', 'ignored', 'deprecated']);
const modeEnum = z.enum(['merge', 'replace']);

const featureInputSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    purpose: z.string().optional(),
    scope: scopeEnum.optional(),
    clusters: z.array(z.string()),
    dependsOn: z.array(z.string()).optional(),
    status: statusEnum.optional(),
    reasoning: z.string().optional(),
  })
  .refine((value) => value.description || value.purpose, {
    message: 'description is required',
    path: ['description'],
  });

const parametersSchema = z.object({
  features: z.array(featureInputSchema).describe('Feature definitions from AI grouping.'),
  mode: modeEnum.optional().describe('Merge (default) or replace AI-managed features.'),
  dryRun: z.boolean().optional().describe('Validate and compute without writing files.'),
});

const inputSchema = z.object({
  features: z.array(featureInputSchema),
  mode: modeEnum.default('merge'),
  dryRun: z.boolean().default(false),
});

export const saveFeaturesFromGroupingTool = {
  name: 'save_features_from_grouping',
  description:
    'Persist AI-grouped features into .featuremap/features and rebuild graph.yaml. Does not perform grouping logic.',
  parameters: parametersSchema.shape,
  execute: async (params: z.infer<typeof parametersSchema>) => {
    const startedAt = new Date().toISOString();
    const featuremapDir = findFeaturemapDir();
    if (!featuremapDir) {
      return buildResponse(
        {
          saved: emptySaveResult(),
          errors: ['No .featuremap directory found. Run "featuremap init" first.'],
          warnings: [],
          _meta: { dryRun: false, mode: 'merge', counts: emptyCounts(), timestamps: { startedAt } },
        },
        true
      );
    }

    const parsed = inputSchema.safeParse(params);
    if (!parsed.success) {
      return buildResponse(
        {
          saved: emptySaveResult(),
          errors: formatZodErrors(parsed.error),
          warnings: [],
          _meta: { dryRun: false, mode: 'merge', counts: emptyCounts(), timestamps: { startedAt } },
        },
        true
      );
    }

    const { features, mode, dryRun } = parsed.data;
    const clustersDir = join(featuremapDir, 'clusters');
    if (!existsSync(clustersDir)) {
      return buildResponse(
        {
          saved: emptySaveResult(),
          errors: ['clusters/ directory not found. Run "featuremap scan" first.'],
          warnings: [],
          _meta: { dryRun, mode, counts: emptyCounts(), timestamps: { startedAt } },
        },
        true
      );
    }

    const clusters = loadClusters(clustersDir);
    const clusterIds = new Set(clusters.keys());
    const errors: string[] = [];
    const warnings: string[] = [];

    const duplicateIds = findDuplicateIds(features.map((feature) => feature.id));
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate feature ids: ${duplicateIds.join(', ')}`);
    }

    for (const feature of features) {
      const missing = normalizeStringList(feature.clusters).filter(
        (clusterId) => !clusterIds.has(clusterId)
      );
      if (missing.length > 0) {
        errors.push(
          `Feature "${feature.id}" references unknown clusters: ${missing.join(', ')}`
        );
      }
    }

    if (errors.length > 0) {
      return buildResponse(
        {
          saved: emptySaveResult(),
          errors,
          warnings,
          _meta: { dryRun, mode, counts: emptyCounts(), timestamps: { startedAt } },
        },
        true
      );
    }

    const featuresDir = join(featuremapDir, 'features');
    if (!dryRun && !existsSync(featuresDir)) {
      mkdirSync(featuresDir, { recursive: true });
    }

    const existingFeatures = loadFeatures(featuresDir);
    const incomingIds = new Set<string>();
    const saved = emptySaveResult();
    const nextFeatures = new Map(existingFeatures);

    const sortedIncoming = [...features].sort((a, b) => a.id.localeCompare(b.id));
    for (const incoming of sortedIncoming) {
      incomingIds.add(incoming.id);
      const existing = existingFeatures.get(incoming.id);
      const result = mergeFeatureWithLocks({
        existing,
        incoming: incoming as FeatureInput,
        clusters,
        now: startedAt,
        warnings,
      });

      if (!result.changed) {
        saved.unchanged.push(incoming.id);
        continue;
      }

      nextFeatures.set(incoming.id, result.feature);
      if (result.isNew) {
        saved.created.push(incoming.id);
      } else {
        saved.updated.push(incoming.id);
      }

      if (!dryRun) {
        writeFeatureYaml(join(featuresDir, `${incoming.id}.yaml`), result.feature);
      }
    }

    if (mode === 'replace') {
      for (const [id, existing] of existingFeatures.entries()) {
        if (incomingIds.has(id)) {
          continue;
        }
        if (existing?.source !== 'ai') {
          continue;
        }
        const result = markFeatureIgnored(existing, startedAt);
        if (!result.changed) {
          continue;
        }
        nextFeatures.set(id, result.feature);
        saved.updated.push(id);
        if (!dryRun) {
          writeFeatureYaml(join(featuresDir, `${id}.yaml`), result.feature);
        }
      }
    }

    saved.created.sort((a, b) => a.localeCompare(b));
    saved.updated.sort((a, b) => a.localeCompare(b));
    saved.unchanged.sort((a, b) => a.localeCompare(b));

    const graphData = buildGraphData([...nextFeatures.values()], clusters, warnings, startedAt);
    const graphWritten = !dryRun && writeGraphYaml(featuremapDir, graphData);

    const result = {
      saved,
      errors: [],
      warnings,
      _meta: {
        dryRun,
        mode,
        counts: {
          inputFeatures: features.length,
          created: saved.created.length,
          updated: saved.updated.length,
          unchanged: saved.unchanged.length,
          totalFeatures: nextFeatures.size,
          graphNodes: graphData.nodes.length,
          graphEdges: graphData.edges.length,
        },
        timestamps: {
          startedAt,
          finishedAt: new Date().toISOString(),
        },
        graphWritten,
        warnings,
      },
    };

    return buildResponse(result);
  },
};

function emptySaveResult(): { created: string[]; updated: string[]; unchanged: string[] } {
  return { created: [], updated: [], unchanged: [] };
}

function emptyCounts(): {
  inputFeatures: number;
  created: number;
  updated: number;
  unchanged: number;
  totalFeatures: number;
  graphNodes: number;
  graphEdges: number;
} {
  return {
    inputFeatures: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    totalFeatures: 0,
    graphNodes: 0,
    graphEdges: 0,
  };
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path
      .map((segment) => (typeof segment === 'number' ? `[${segment}]` : String(segment)))
      .join('.');
    return `${path || '<root>'}: ${issue.message}`;
  });
}

function buildResponse(payload: unknown, isError = false) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}
