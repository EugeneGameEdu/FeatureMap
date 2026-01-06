import { z } from 'zod';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';
import { filterCommentsForNode, loadComments } from '../utils/commentLoader.js';

const parametersSchema = z.object({
  nodeType: z.enum(['feature', 'cluster']).describe('Node type to inspect.'),
  id: z.string().min(1).describe('Feature or cluster id.'),
  includeContent: z.boolean().optional().describe('Include comment content (default: true).'),
  maxComments: z.number().int().positive().optional().describe('Max comments to return.'),
});

export const getNodeCommentsTool = {
  name: 'get_node_comments',
  description: 'Return comments directly linked to a node, scoped to the correct view.',
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

    const includeContent = params.includeContent ?? true;
    const comments = filterCommentsForNode(
      loadComments(featuremapDir),
      params.nodeType,
      params.id
    );

    const maxComments = params.maxComments ?? comments.length;
    const truncated = comments.length > maxComments;
    const returned = comments.slice(0, maxComments);

    const payload = {
      comments: returned.map((comment) => ({
        id: comment.id,
        homeView: comment.homeView,
        ...(includeContent ? { content: comment.content } : {}),
        links: comment.links,
        ...(comment.createdAt ? { createdAt: comment.createdAt } : {}),
        ...(comment.updatedAt ? { updatedAt: comment.updatedAt } : {}),
      })),
      _meta: {
        totalCount: comments.length,
        returnedCount: returned.length,
        truncated,
        hint: truncated
          ? 'Increase maxComments to see more.'
          : 'Set includeContent=false for metadata-only.',
      },
    };

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    };
  },
};
