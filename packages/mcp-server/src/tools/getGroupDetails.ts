import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { normalizeStringList } from '../utils/listUtils.js';
import { loadGroups } from '../utils/groupYaml.js';

const parametersSchema = z.object({
  groupId: z.string().min(1).describe('Group ID to inspect.'),
});

const groupDetailsSchema = z.object({
  group: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    featureIds: z.array(z.string()),
    note: z.string().optional(),
  }),
  _meta: z.object({
    featureCount: z.number().int().nonnegative(),
  }),
});

export const getGroupDetailsTool = {
  name: 'get_group_details',
  description: 'Get group metadata and full group note.',
  parameters: parametersSchema.shape,
  execute: async (params: z.infer<typeof parametersSchema>) => {
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

    const groupsById = loadGroups(featuremapDir);
    const group = groupsById.get(params.groupId);
    if (!group) {
      const hint = buildGroupIdHint(params.groupId, groupsById);
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: Group "${params.groupId}" not found.${hint}`,
          },
        ],
        isError: true,
      };
    }

    const featureIds = normalizeStringList(group.featureIds);
    const result = groupDetailsSchema.parse({
      group: {
        id: group.id,
        name: group.name,
        ...(group.description !== undefined ? { description: group.description } : {}),
        featureIds,
        ...(group.note !== undefined ? { note: group.note } : {}),
      },
      _meta: {
        featureCount: featureIds.length,
      },
    });

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  },
};

function buildGroupIdHint(groupId: string, groupsById: Map<string, { id: string }>): string {
  const normalized = groupId.toLowerCase();
  const ids = [...groupsById.keys()];
  const matches = ids
    .filter((id) => id.toLowerCase().includes(normalized))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 5);

  if (matches.length === 0) {
    return '';
  }

  return ` Closest ids: ${matches.join(', ')}.`;
}
