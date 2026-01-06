const cwd = process.cwd().replace(/\\/g, '/');

const snippet = [
  '[mcp_servers.featuremap]',
  'command = "node"',
  'args = ["packages/mcp-server/dist/index.js"]',
  `cwd = "${cwd}"`,
  '',
].join('\n');

console.log(snippet);
