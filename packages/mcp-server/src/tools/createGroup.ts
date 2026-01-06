import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import { GroupSchema, type GroupFile } from '../types/group.js';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { loadFeatures } from '../utils/featureLoader.js';
import { findDuplicateIds, normalizeStringList } from '../utils/listUtils.js';
import { buildGroupYaml, getGroupPath, groupExists, readGroupYaml, writeGroupYaml } from '../utils/groupYaml.js';
import { isKebabCase, slugifyToKebab } from '../utils/slugify.js';

const parametersSchema = z.object({
  name: z.string().describe('Group name.'),
  description: z.string().optional().describe('Group description.'),
  featureIds: z.array(z.string()).min(1).describe('Feature IDs to include in the group.'),
  id: z.string().optional().describe('Optional kebab-case override for the group id.'),
  dryRun: z.boolean().optional().describe('Return what would be written without writing files.'),
  allowUpdate: z.boolean().optional().describe('Allow overwriting an existing group file.'),
});

const inputSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().optional(),
    featureIds: z.array(z.string().trim().min(1)).min(1),
    id: z.string().optional(),
    dryRun: z.boolean().default(false),
    allowUpdate: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.id && !isKebabCase(value.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'id must be kebab-case (lowercase with hyphens)',
        path: ['id'],
      });
    }
  });

export const createGroupTool = {
  name: 'create_group',
  description:
    'Create a user-defined group in .featuremap/groups/*.yaml. Validates feature IDs and avoids overwrites unless allowUpdate is true.',
  parameters: parametersSchema.shape,
  execute: async (params: z.infer<typeof parametersSchema>) => {
    const startedAt = new Date().toISOString();
    const featuremapDir = findFeaturemapDir();
    if (!featuremapDir) {
      return buildResponse(
        {
          status: 'error',
          errors: ['No .featuremap directory found. Run "featuremap init" first.'],
        },
        true
      );
    }

    const parsed = inputSchema.safeParse(params);
    if (!parsed.success) {
      return buildResponse(
        {
          status: 'error',
          errors: formatZodErrors(parsed.error),
        },
        true
      );
    }

    const { name, description, featureIds, id, dryRun, allowUpdate } = parsed.data;
    const computedId = id ?? slugifyToKebab(name);
    if (!computedId) {
      return buildResponse(
        {
          status: 'error',
          errors: ['Unable to derive a valid id from name. Provide an explicit id.'],
        },
        true
      );
    }

    if (!isKebabCase(computedId)) {
      return buildResponse(
        {
          status: 'error',
          errors: ['Group id must be kebab-case (lowercase with hyphens).'],
        },
        true
      );
    }

    const featuresDir = join(featuremapDir, 'features');
    if (!existsSync(featuresDir)) {
      return buildResponse(
        {
          status: 'error',
          errors: ['features/ directory not found. Run "featuremap scan" first.'],
        },
        true
      );
    }

    const warnings: string[] = [];
    const duplicateIds = findDuplicateIds(featureIds);
    if (duplicateIds.length > 0) {
      warnings.push(`Duplicate featureIds removed: ${duplicateIds.join(', ')}`);
    }

    const normalizedFeatureIds = normalizeStringList(featureIds);
    const features = loadFeatures(featuresDir);
    const missing = normalizedFeatureIds.filter((featureId) => !features.has(featureId));
    if (missing.length > 0) {
      return buildResponse(
        {
          status: 'error',
          errors: [`Unknown featureIds: ${missing.join(', ')}`],
          warnings,
        },
        true
      );
    }

    const groupPath = getGroupPath(featuremapDir, computedId);
    const existsAlready = groupExists(groupPath);
    if (existsAlready && !allowUpdate) {
      return buildResponse(
        {
          status: 'error',
          errors: [`Group "${computedId}" already exists.`],
        },
        true
      );
    }

    const existingGroup = existsAlready ? readGroupYaml(groupPath) : null;
    const metadataVersion = existingGroup?.metadata.version ?? 1;
    const createdAt = existingGroup?.metadata.createdAt ?? startedAt;
    const resolvedDescription = description ?? existingGroup?.description;
    const resolvedLocks = existingGroup?.locks;

    const group: GroupFile = GroupSchema.parse({
      version: 1,
      id: computedId,
      name,
      description: resolvedDescription,
      featureIds: normalizedFeatureIds,
      source: 'ai',
      locks: resolvedLocks,
      metadata: {
        createdAt,
        updatedAt: startedAt,
        lastModifiedBy: 'ai',
        version: metadataVersion,
      },
    });

    const yamlPreview = buildGroupYaml(group);
    if (dryRun) {
      return buildResponse({
        status: 'dry_run',
        id: computedId,
        path: groupPath,
        written: false,
        warnings,
        group,
        yaml: yamlPreview,
      });
    }

    const writtenPath = writeGroupYaml(featuremapDir, group);
    return buildResponse({
      status: existsAlready ? 'updated' : 'created',
      id: computedId,
      path: writtenPath,
      written: true,
      warnings,
    });
  },
};

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
