# FeatureMap

Visual feature map for your codebase. Automatically analyzes your project structure and creates an interactive map of features.

## Quick Start

```bash
# Initialize in your project
npx featuremap init

# Scan and build feature map
npx featuremap scan

# Start web interface
npx featuremap web
```

## Features

- 📊 **Visual Map** — Interactive graph of project features
- 🔍 **Auto-detection** — Automatically finds and groups related files
- 🤖 **AI Integration** — MCP server for AI-assisted analysis
- 📁 **File Tracking** — See which files belong to which feature

## Project Structure

```
packages/
├── cli/          # Command-line interface
├── mcp-server/   # MCP server for AI tools
└── web/          # React web interface
```

## MCP Integration

Connect your AI assistant (Cursor, Claude Desktop, etc.) to get intelligent analysis:

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

See [packages/mcp-server/README.md](packages/mcp-server/README.md) for details.

## Commands

| Command | Description |
|---------|-------------|
| `featuremap init` | Initialize FeatureMap in project |
| `featuremap scan` | Analyze project and build feature map |
| `featuremap web` | Start web interface |

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run web in development
npm run dev --workspace=@featuremap/web
```

## License

MIT
