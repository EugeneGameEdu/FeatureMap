#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'featuremap',
  version: '0.1.0',
});

// Tools will be added in Phase 5
// For now, just a basic server that starts and responds

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('FeatureMap MCP server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
