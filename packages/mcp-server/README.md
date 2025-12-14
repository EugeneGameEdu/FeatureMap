# @featuremap/mcp-server

MCP server for FeatureMap — allows AI assistants to analyze and update your project's feature map.

## Installation

The MCP server is part of the FeatureMap monorepo. Build it with:

```bash
npm run build --workspace=@featuremap/mcp-server
```

## Available Tools

### get_project_structure

Get the raw dependency graph of the project.

**Parameters:**
- `projectRoot` (optional): Path to project root. Defaults to current directory.

**Returns:** All files with their exports, imports, and dependencies.

### get_current_features

Get all currently defined features with metadata.

**Parameters:**
- `projectRoot` (optional): Path to project root. Defaults to current directory.

**Returns:** List of features with files, descriptions, dependencies, and summary statistics.

### update_feature

Update a feature's name, description, or status.

**Parameters:**
- `projectRoot` (optional): Path to project root
- `id` (required): Feature ID (e.g., "cli-commands")
- `name` (optional): New human-readable name
- `description` (optional): Description of what the feature does
- `status` (optional): "active", "deprecated", or "ignored"

**Returns:** Updated feature data and list of changes made.

## Configuration

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "featuremap": {
      "command": "node",
      "args": ["/path/to/featuremap/packages/mcp-server/dist/index.js"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### Claude Desktop

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "featuremap": {
      "command": "node",
      "args": ["/path/to/featuremap/packages/mcp-server/dist/index.js"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### VS Code + Continue

Add to Continue configuration:

```json
{
  "mcpServers": {
    "featuremap": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"]
    }
  }
}
```

## Usage Examples

Once connected, you can ask your AI assistant:

- "Show me the project structure"
- "What features are in this project?"
- "Give better names and descriptions to all features"
- "Mark the old-auth feature as deprecated"

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev
```
