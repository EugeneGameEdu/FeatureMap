# FeatureMap MCP Server (Tools & Setup)

## Build / Install

- Build: `npm run build --workspace=@featuremap/mcp-server`
- Example MCP config: `mcp-config.example.json`
- Helper scripts (Codex): `npm run mcp:codex:snippet` and `npm run mcp:codex:add`
- CLI helper: `featuremap scan --ai` prints an MCP config snippet for Cursor-style clients.

The MCP server binary is `featuremap-mcp` (or `node packages/mcp-server/dist/index.js`).

## What MCP Is For (In FeatureMap)

MCP lets an AI client query the FeatureMap “map” instead of reading the whole codebase.

Typical flow:

1. Load project context (`get_project_context`)
2. Inspect clusters (`get_grouping_input`, `get_cluster_files`)
3. Inspect existing features (`get_current_features`, `get_feature_details`)
4. Persist updates (`save_features_from_grouping`)

## Tool List (Current)

### Read / Navigation

- `get_architecture_overview`: summary of features/clusters, counts, and relationships.
- `get_feature_details`: Level 2 details for a feature (and clusters it contains).
- `get_cluster_files`: Level 3 detail: cluster metadata and file list.
- `get_group_details`: group metadata + full group note.
- `find_relevant_features`: deterministic token-matching search over feature names/descriptions.
- `get_node_comments`: comments linked to a feature or cluster.
- `get_current_features`: full list of `.featuremap/features/*.yaml` with metadata/deps.

### Context

- `get_project_context`: loads `.featuremap/context/*.yaml` with optional filtering.
- `get_grouping_input`: compact, model-friendly snapshot for grouping clusters into features.

### Write / Modification

- `save_features_from_grouping`: writes `.featuremap/features/*.yaml` and rebuilds the feature overlay in `graph.yaml`.
- `create_group`: creates `.featuremap/groups/*.yaml`.
- `update_feature`: updates a single feature’s `name`/`description`/`status`.

Important lock behavior:

- `save_features_from_grouping` respects feature locks when merging.
- `update_feature` currently updates fields directly and may ignore locks; prefer `save_features_from_grouping` for lock-safe edits.

## Resources

The server exposes a small resource for client discovery:

- `featuremap://guide/agent`
