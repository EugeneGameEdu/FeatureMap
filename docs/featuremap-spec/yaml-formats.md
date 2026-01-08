# FeatureMap YAML Formats (Reference)

This describes the YAML files under `.featuremap/`. All files include a `version` field (integer).

Zod parsing uses “strip unknown keys” semantics for most files; some schemas (notably comments) are strict.

## `.featuremap/config.yaml`

Purpose: project + scan configuration, plus optional hints that guide feature grouping.

Key fields:

- `project.name` (string)
- `project.root` (string): scan root relative to repo root (usually `"."`)
- `scan.include` / `scan.exclude` (string arrays): glob patterns
- `features.hints[]`:
  - `pattern` (string): glob-ish hint
  - `type` (string): category label for grouping

## `.featuremap/clusters/*.yaml` (Cluster)

Purpose: technical file groupings, regenerated on scan but preserves some user-authored fields.

Key fields:

- `id` (string): stable identifier
- `layer` (`frontend` | `backend` | `shared` | `infrastructure`)
- `layerDetection` (optional): `{ confidence: high|medium|low, signals: string[] }`
- `files` (string[]): relative paths from scan root
- `exports` (array): `{ name, type, isDefault? }`
- `imports`: `{ internal: string[], external: string[] }`
- `compositionHash` (string): stable hash of the cluster’s file list
- Preserved/user fields:
  - `purpose_hint?` (string)
  - `entry_points?` (string[])
  - `locks?` (e.g. `{ layer?: boolean, files?: boolean }`)

## `.featuremap/features/*.yaml` (Feature)

Purpose: architectural grouping of clusters.

Key fields:

- `id`, `name`
- `description?` / `purpose?` (at least one is expected when created via MCP grouping)
- `source` (`auto` | `ai` | `user`)
- `status` (`active` | `ignored` | `deprecated`)
- `scope` (`frontend` | `backend` | `fullstack` | `shared`)
- `clusters` (string[]): cluster IDs
- `dependsOn?` (string[]): feature IDs
- `composition.hash` (string): stable hash derived from the feature’s clusters + cluster compositions
- `locks?` (object): commonly includes `name`, `description`, `clusters` (and may include other lock keys)
- `metadata`: `{ createdAt, updatedAt, lastModifiedBy?, version? }`
- `reasoning?` (string): AI explanation

## `.featuremap/groups/*.yaml` (Group)

Purpose: named sets of feature IDs, used for filtering and group containers in the web UI.

Key fields:

- `id`, `name`, `description?`
- `featureIds` (string[])
- `note?` (string): longer group note (editable via API)
- `source` (`ai` | `user`)
- `locks?` (object): `name`, `description`, `featureIds`
- `metadata`: `{ createdAt, updatedAt, lastModifiedBy, version }`

## `.featuremap/comments/*.yaml` (Comment) — strict schema

Purpose: map annotations with a position and optional links to features/clusters.

Key fields:

- `id` (kebab-case)
- `content` (non-empty string)
- `position`: `{ x, y }`
- `links`: array of `{ type: feature|cluster, id }`
- Optional: `homeView` (`features` | `clusters`), `pinned`, `tags`, `priority`, `author`, `createdAt`, `updatedAt`

## `.featuremap/graph.yaml` (Graph)

Purpose: nodes/edges for visualization. The web UI treats this as the source of “what nodes exist”.

Node fields:

- `id`, `label`
- `type`: `cluster` or `feature`
- Optional: `fileCount`, `clusterCount`, `layer`, `layers`

Edge fields:

- `source`, `target`
- Optional: `type` (commonly used values include `feature_dep` and `contains`)

Notes:

- `featuremap scan` rebuilds the cluster graph portion. Feature overlay is rebuilt by MCP grouping (`save_features_from_grouping`).

## `.featuremap/layout.yaml` (Layout)

Purpose: saved positions and viewport from the web UI.

Key fields:

- `positions`: map of node id -> `{ x, y }`
- `viewport?`: `{ x, y, zoom }`
- `metadata.updatedAt`

## `.featuremap/context/*.yaml` (Context)

Purpose: extra guidance for AI and humans.

- Auto-generated: `tech-stack.yaml`, `conventions.yaml`
- Manual (templates): `decisions.yaml`, `constraints.yaml`, `overview.yaml`, `design-system.yaml`

## `featuremap-data` indices (served/generated)

The web app loads `groups/index.yaml` and `comments/index.yaml` from `/featuremap-data/...`.

These index files are not required to exist in `.featuremap/`:

- `featuremap web` generates them in the copied `public/featuremap-data` directory.
- `featuremap serve` can synthesize them on-demand via HTTP even if no index file exists.

