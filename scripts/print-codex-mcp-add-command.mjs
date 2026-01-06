const cwd = process.cwd();
const escapedCwd = cwd.replace(/"/g, '\\"');

const command = `codex mcp add featuremap --cwd "${escapedCwd}" -- node packages/mcp-server/dist/index.js`;
console.log(command);
