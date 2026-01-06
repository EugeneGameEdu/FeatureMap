# Connect FeatureMap MCP to Codex (VS Code extension)

## What MCP is here
FeatureMap includes a local MCP server that runs as a Node process:
- Entry point: `packages/mcp-server/dist/index.js`
- Tools: `get_project_context`, `get_grouping_input`, `save_features_from_grouping`,
  `get_current_features`, `update_feature`

## Two MCP ecosystems (do not confuse them)
- VS Code Copilot MCP uses `.vscode/mcp.json` and the Copilot gallery.
- Codex MCP uses `~/.codex/config.toml` and is shared between the Codex CLI and
  the Codex VS Code extension.

If you configure only `.vscode/mcp.json`, Codex will not see the server.

## Setup for Codex in VS Code

### 1) Build the MCP server
```bash
npm run build --workspace=@featuremap/mcp-server
```

### 2) Add the server to Codex (pick one)

Option A: CLI helper
```bash
codex mcp add featuremap --cwd "<repo-root>" -- node packages/mcp-server/dist/index.js
```

Option B: Edit `~/.codex/config.toml`
```toml
[mcp_servers.featuremap]
command = "node"
args = ["packages/mcp-server/dist/index.js"]
cwd = "<repo-root>"
```

Tip: run `npm run mcp:codex:snippet` to print a ready-to-paste TOML snippet, or
`npm run mcp:codex:add` to print the CLI command.

### 3) Verify inside Codex
- Open `~/.codex/config.toml` or MCP settings in the Codex VS Code extension.
- Use `/mcp` in the Codex chat to list active servers.
- Confirm the `featuremap` server exposes tools like `get_project_context`.

## Windows notes
- Prefer the helper scripts to avoid quoting issues.
- In TOML, use forward slashes in `cwd`, for example
  `C:/Projects/FeatureMap`.
- If you use the CLI command, keep the `--cwd` value in double quotes.

## macOS/Linux notes
- The CLI command works as-is.
- In TOML, you can use the absolute path from `pwd`.
