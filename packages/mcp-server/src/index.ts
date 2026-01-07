#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getCurrentFeatures } from './tools/getCurrentFeatures.js';
import { updateFeature } from './tools/updateFeature.js';
import { getProjectContextTool } from './tools/getProjectContext.js';
import { getGroupingInputTool } from './tools/getGroupingInput.js';
import { saveFeaturesFromGroupingTool } from './tools/saveFeaturesFromGrouping.js';
import { createGroupTool } from './tools/createGroup.js';
import { getArchitectureOverviewTool } from './tools/getArchitectureOverview.js';
import { getFeatureDetailsTool } from './tools/getFeatureDetails.js';
import { getClusterFilesTool } from './tools/getClusterFiles.js';
import { findRelevantFeaturesTool } from './tools/findRelevantFeatures.js';
import { getNodeCommentsTool } from './tools/getNodeComments.js';
import { getGroupDetailsTool } from './tools/getGroupDetails.js';

const server = new McpServer({
  name: 'featuremap',
  version: '0.1.0',
});

const agentGuide = `FeatureMap MCP quick guide

- Prefer MCP tools over direct file access when possible.
- Use get_project_context first to load project context.
  - Pass layer or subject to keep context focused.
  - designSystem is only returned for frontend layer.
- Use get_grouping_input to understand clusters before grouping.
- Use get_current_features to list existing features.
- Use update_feature or save_features_from_grouping to persist updates.

If resources list is empty, the server may only expose tools.
This resource exists so clients can discover basic usage quickly.`;

server.registerResource(
  'agent-guide',
  'featuremap://guide/agent',
  {
    title: 'FeatureMap MCP agent guide',
    description: 'Quick usage notes for MCP tools and context loading.',
    mimeType: 'text/markdown',
  },
  () => ({
    contents: [
      {
        uri: 'featuremap://guide/agent',
        mimeType: 'text/markdown',
        text: agentGuide,
      },
    ],
  })
);

// Tool: get_current_features
server.tool(
  'get_current_features',
  'Get all currently defined features with their metadata, files, dependencies, and descriptions. Use this to understand what features exist in the project.',
  {
    projectRoot: z.string().optional().describe('Path to project root. Defaults to current directory.'),
  },
  async ({ projectRoot }) => {
    const root = projectRoot || process.cwd();
    const result = getCurrentFeatures(root);

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `Error: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// Tool: update_feature
server.tool(
  'update_feature',
  'Update a feature\'s name, description, or status. Use this to give features human-readable names and descriptions after analyzing the code.',
  {
    projectRoot: z.string().optional().describe('Path to project root. Defaults to current directory.'),
    id: z.string().describe('Feature ID (e.g., "cli-commands", "web-core")'),
    name: z.string().optional().describe('New human-readable name for the feature'),
    description: z.string().optional().describe('Description of what this feature does'),
    status: z.enum(['active', 'deprecated', 'ignored']).optional().describe('Feature status'),
  },
  async ({ projectRoot, id, name, description, status }) => {
    const root = projectRoot || process.cwd();
    const result = updateFeature(root, { id, name, description, status });

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `Error: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// Tool: get_project_context
server.tool(
  getProjectContextTool.name,
  getProjectContextTool.description,
  getProjectContextTool.parameters,
  getProjectContextTool.execute
);

// Tool: get_grouping_input
server.tool(
  getGroupingInputTool.name,
  getGroupingInputTool.description,
  getGroupingInputTool.parameters,
  getGroupingInputTool.execute
);

// Tool: save_features_from_grouping
server.tool(
  saveFeaturesFromGroupingTool.name,
  saveFeaturesFromGroupingTool.description,
  saveFeaturesFromGroupingTool.parameters,
  saveFeaturesFromGroupingTool.execute
);

// Tool: create_group
server.tool(
  createGroupTool.name,
  createGroupTool.description,
  createGroupTool.parameters,
  createGroupTool.execute
);

// Tool: get_architecture_overview
server.tool(
  getArchitectureOverviewTool.name,
  getArchitectureOverviewTool.description,
  getArchitectureOverviewTool.parameters,
  getArchitectureOverviewTool.execute
);

// Tool: get_feature_details
server.tool(
  getFeatureDetailsTool.name,
  getFeatureDetailsTool.description,
  getFeatureDetailsTool.parameters,
  getFeatureDetailsTool.execute
);

// Tool: get_cluster_files
server.tool(
  getClusterFilesTool.name,
  getClusterFilesTool.description,
  getClusterFilesTool.parameters,
  getClusterFilesTool.execute
);

// Tool: get_group_details
server.tool(
  getGroupDetailsTool.name,
  getGroupDetailsTool.description,
  getGroupDetailsTool.parameters,
  getGroupDetailsTool.execute
);

// Tool: find_relevant_features
server.tool(
  findRelevantFeaturesTool.name,
  findRelevantFeaturesTool.description,
  findRelevantFeaturesTool.parameters,
  findRelevantFeaturesTool.execute
);

// Tool: get_node_comments
server.tool(
  getNodeCommentsTool.name,
  getNodeCommentsTool.description,
  getNodeCommentsTool.parameters,
  getNodeCommentsTool.execute
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FeatureMap MCP server started with 12 tools');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
