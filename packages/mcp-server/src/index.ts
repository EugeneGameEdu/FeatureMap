#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getCurrentFeatures } from './tools/getCurrentFeatures.js';
import { updateFeature } from './tools/updateFeature.js';
import { getProjectContextTool } from './tools/getProjectContext.js';

const server = new McpServer({
  name: 'featuremap',
  version: '0.1.0',
});

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FeatureMap MCP server started with 3 tools');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
