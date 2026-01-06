# FeatureMap

> Visual feature map for your codebase — automatically analyzes project structure and creates an interactive map.

![FeatureMap Screenshot](docs/screenshot.png)

## ✨ Features

- 📊 **Interactive Map** — Visual graph of project features using React Flow
- 🔍 **Auto-detection** — Automatically finds and groups related files into features
- 🤖 **AI Integration** — MCP server for AI-assisted naming and descriptions
- 📁 **Dependency Tracking** — See how features depend on each other
- 🎯 **Click to Explore** — Sidebar shows files, exports, and metadata

## 🚀 Quick Start

```bash
# 1. Initialize in your project
npx featuremap init

# 2. Scan and build feature map  
npx featuremap scan

# 3. Start web interface
npx featuremap web
```

Open http://localhost:3000 to see your feature map!

## 📋 Commands

| Command | Description |
|---------|-------------|
| `featuremap init` | Initialize `.featuremap/` directory with config |
| `featuremap scan` | Analyze project and generate feature map |
| `featuremap scan --ai` | Scan + show MCP integration instructions |
| `featuremap web` | Start interactive web interface |
| `featuremap web --port 4000` | Start on custom port |

## 🤖 AI Integration (MCP)

FeatureMap includes an MCP server that lets AI assistants analyze and improve your feature map.

### Setup for Cursor

Add to `~/.cursor/mcp.json`:

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

### Available AI Tools

| Tool | Description |
|------|-------------|
| `get_project_structure` | Get raw dependency graph |
| `get_current_features` | List all features with metadata |
| `update_feature` | Update feature name/description |

### Example Prompts

- *"Analyze the features and give them better names"*
- *"What are the main features of this project?"*
- *"Mark the legacy-auth feature as deprecated"*

## Connect Codex to FeatureMap MCP

```bash
npm run mcp:build
npm run mcp:codex:snippet
```

Full setup guide: `docs/mcp/codex-vscode-setup.md`

## 📁 Project Structure

```
.featuremap/
├── config.yaml      # Scan configuration
├── graph.yaml       # Feature graph for visualization
├── raw-graph.yaml   # Raw dependency data
└── features/        # Individual feature files
    ├── cli-commands.yaml
    ├── web-core.yaml
    └── ...
```

## 🛠 Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run web in dev mode
npm run dev --workspace=@featuremap/web

# Build specific package
npm run build --workspace=@featuremap/cli
```

### Packages

| Package | Description |
|---------|-------------|
| `@featuremap/cli` | Command-line interface |
| `@featuremap/mcp-server` | MCP server for AI integration |
| `@featuremap/web` | React web interface |

## 📄 Configuration

Edit `.featuremap/config.yaml` to customize scanning:

```yaml
project:
  name: "My Project"

scan:
  include:
    - "src/**/*.ts"
    - "src/**/*.tsx"
  exclude:
    - "**/*.test.ts"
    - "**/node_modules/**"
```

## 🐍 Dogfooding

This project uses FeatureMap to analyze itself! Run `featuremap scan` and `featuremap web` in this repo to see the feature map of FeatureMap.

## 📝 License

MIT

---

Made with ❤️ and a lot of recursion 🐍
