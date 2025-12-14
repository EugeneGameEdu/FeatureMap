#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getProjectStructure } from './tools/getProjectStructure.js';

const server = new McpServer({
  name: 'featuremap',
  version: '0.1.0',
});

// Tool: get_project_structure
server.tool(
  'get_project_structure',
  'Get the raw dependency graph of the project. Returns all files, their exports, imports, and dependencies between them.',
  {
    projectRoot: z.string().optional().describe('Path to project root. Defaults to current directory.'),
  },
  async ({ projectRoot }) => {
    const root = projectRoot || process.cwd();
    const result = getProjectStructure(root);

    if (!result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FeatureMap MCP server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
