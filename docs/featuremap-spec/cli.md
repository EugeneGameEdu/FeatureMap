# FeatureMap CLI & Config (Details)

## Build / Run

- Build: `npm run build --workspace=@featuremap/cli`
- Run from repo root:
  - `node packages/cli/dist/index.js --help`
  - `node packages/cli/dist/index.js scan`

## Commands

### `featuremap init`

Creates `.featuremap/` scaffold:

- `.featuremap/config.yaml`
- `.featuremap/clusters/`
- `.featuremap/features/`
- `.featuremap/comments/`
- `.featuremap/context/`
- `.featuremap/layout.yaml` (only if missing)

### `featuremap scan`

Performs:

1. Loads `.featuremap/config.yaml`
2. Scans files (TypeScript/JS + optional Go)
3. Builds a dependency graph
4. Groups files into clusters and writes `.featuremap/clusters/*.yaml`
5. Updates derived context:
   - `.featuremap/context/tech-stack.yaml`
   - `.featuremap/context/conventions.yaml`
6. Regenerates `.featuremap/graph.yaml`

Flags:

- `--ai`: prints an MCP client snippet for AI-assisted grouping.

Note: this command does **not** currently implement `--verbose`.

### `featuremap context init`

Creates missing templates in `.featuremap/context/` and refreshes auto context:

- Auto-refreshed: `tech-stack.yaml`, `conventions.yaml`
- Templates (manual): `decisions.yaml`, `constraints.yaml`, `overview.yaml`, `design-system.yaml`

### `featuremap validate`

Validates `.featuremap/**/*.yaml` with Zod schemas.

### `featuremap web`

Dev-mode web UI:

1. Copies `.featuremap/` into the web app’s `public/featuremap-data/`
2. Runs `npm run dev` in `packages/web`

### `featuremap serve`

Hosts:

- Web UI
- Local API under `/api/*`
- WebSocket at `/ws`
- Static data under `/featuremap-data/*` (served from `.featuremap/`)

Flags:

- `--dev`: uses Vite middleware and performs an initial sync into the web app.

## `config.yaml` Reference

Schema highlights:

- `project.root`: scan root (resolved from repo root)
- `scan.include` / `scan.exclude`: glob patterns
- `features.hints`: optional hint list for grouping guidance

Example:

```yaml
version: 1
project:
  name: "My Project"
  root: "."

scan:
  include:
    - "src/**/*.{ts,tsx,js,jsx}"
    - "packages/*/src/**/*.{ts,tsx,js,jsx}"
  exclude:
    - "**/*.test.*"
    - "**/*.spec.*"
    - "**/*.d.ts"
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/build/**"

features:
  hints:
    - pattern: "src/features/auth/**"
      type: "authentication"
```

## Language Support (Current)

### TypeScript / JavaScript

- Parser: `ts-morph` (AST)
- Files: `.ts`, `.tsx`, `.js`, `.jsx`
- Extracts: exports, imports (internal/external), LOC

### Go

- Parser: regex-based (no Go toolchain dependency)
- Files: `.go` (excludes `*_test.go`), skips generated files starting with `// Code generated`
- Uses `go.mod` to determine module path for internal vs external imports

## Subproject Detection

Scan detects subprojects by finding:

- `package.json` (TypeScript/JS subproject)
- `go.mod` (Go subproject)

Each discovered subproject is scanned, and cluster IDs naturally include the subproject/package name based on file paths.

## Cluster IDs and Stability

Clusters are grouped by folders with these common outcomes:

- `packages/cli/src/index.ts` -> `cli-core`
- `packages/cli/src/commands/*.ts` -> `cli-commands`
- `packages/web/src/components/*` -> `web-components` (and sometimes `web-components-ui`)

On rescan, new cluster candidates are matched to existing clusters by **file overlap** (Jaccard similarity). Default threshold is **0.7** (70%).

