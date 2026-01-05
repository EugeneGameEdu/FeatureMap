# FeatureMap — Technical Specification

> Single source of truth for the FeatureMap project architecture and development plan.

**Last updated:** January 2025  
**Current phase:** Phase 0 (Foundation)

---

## What is FeatureMap

FeatureMap visualizes codebases as architectural maps that both developers and non-developers can understand.

**Core flow:**
```
Code → CLI parses → Clusters (technical) → AI groups → Features (architectural) → Web visualizes
```

**Key insight:** AI reads the map, not the entire codebase. This enables smart architectural advice without token limits.

---

## Tech Stack

| Package | Technologies |
|---------|--------------|
| `packages/cli` | TypeScript, ts-morph, commander, yaml, zod, chokidar |
| `packages/mcp-server` | @modelcontextprotocol/sdk, yaml |
| `packages/web` | React, @xyflow/react, Vite, TailwindCSS, shadcn/ui |

---

## Data Structure

```
.featuremap/
├── config.yaml              # Project configuration
├── clusters/                # Technical level (from parser)
│   └── *.yaml              
├── features/                # Architectural level (from AI)
│   └── *.yaml              
├── groups/                  # User-defined groupings
│   └── *.yaml              
├── context/                 # Project context for AI
│   ├── tech-stack.yaml     # (auto-generated)
│   ├── conventions.yaml    # (auto-generated)
│   ├── decisions.yaml      # (manual)
│   ├── constraints.yaml    # (manual)
│   └── design-system.yaml  # (manual)
├── comments/                # Notes on the map
│   └── *.yaml
├── graph.yaml               # Nodes & edges for visualization
└── layout.yaml              # Node positions (user-editable)
```

### File Categories

| Category | Files | Behavior |
|----------|-------|----------|
| **Derived** | graph.yaml, context/tech-stack.yaml, context/conventions.yaml | Regenerated on scan, safe to delete |
| **Authored** | clusters/*, features/*, groups/*, comments/*, layout.yaml, context/decisions.yaml | User/AI edits preserved, respect locks |

---

## Core Data Types

### Cluster (technical grouping)
```yaml
id: cli-commands
layer: backend                    # frontend | backend | shared | infrastructure
files:
  - path: src/commands/init.ts
    exports: [initCommand]
    imports: { internal: [...], external: [...] }
purpose_hint: "CLI entry points"
compositionHash: "abc123"         # For stability detection
```

### Feature (architectural grouping)
```yaml
id: authentication
name: "Authentication System"
description: "Handles user login, registration, and session management"
source: ai                        # auto | ai | user
status: active                    # active | ignored | deprecated
scope: fullstack                  # frontend | backend | fullstack | shared
clusters:
  - auth-api
  - auth-ui
  - auth-utils
dependsOn:
  - database
  - user-management
composition:
  hash: "def456"                  # Changes when clusters change
locks:                            # Protect from AI overwrite
  name: true
  description: false
metadata:
  createdAt: "2025-01-01T00:00:00Z"
  updatedAt: "2025-01-01T00:00:00Z"
  lastModifiedBy: ai
  version: 1
```

### Graph (for visualization)
```yaml
version: 1
generatedAt: "2025-01-01T00:00:00Z"
nodes:
  - id: authentication
    label: "Authentication System"
    type: feature
    fileCount: 8
edges:
  - source: authentication
    target: database
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `featuremap init` | Create .featuremap/ directory with config |
| `featuremap scan` | Parse code, build clusters, generate graph |
| `featuremap scan --ai` | Scan + start MCP server for AI grouping |
| `featuremap validate` | Validate all YAML files against schemas |
| `featuremap web` | Start web visualization |
| `featuremap serve` | (future) API + WebSocket + MCP server |

---

## MCP Tools (for AI)

### Currently implemented:
- `get_project_structure` — Returns clusters and their relationships
- `get_current_features` — Returns all features
- `update_feature` — Update feature name/description

### Planned:
- `get_project_context` — Tech stack, conventions, constraints
- `get_grouping_input` — Clusters ready for AI grouping
- `save_features_from_grouping` — Save AI's grouping decisions
- `create_group` — Create user-defined groups
- `get_feature_comments` — Get comments for a feature

---

## Development Phases

### Phase 0: Foundation ✅ In Progress
- [x] 0.1 TypeScript types + Zod schemas
- [x] 0.2 Deterministic YAML writing
- [x] 0.2.1 Remove raw-graph.yaml
- [ ] 0.3 Validate command
- [ ] 0.4 Version checks

### Phase 1: Infrastructure
- [ ] 1.1 Clusters vs Features separation (with locks)
- [ ] 1.2 Layer detection (frontend/backend/shared)
- [ ] 1.3 Context directory structure
- [ ] 1.4 Cluster ID stability

### Phase 2: AI Grouping
- [ ] 2.1 Tech stack analysis
- [ ] 2.2 Conventions analysis
- [ ] 2.3 MCP get_project_context
- [ ] 2.4 MCP tools for grouping
- [ ] 2.5 Web Level 1 (features view)
- [ ] 2.6 Composition hash for stability

### Phase 3: Project Context
- [ ] 3.1 Context init command
- [ ] 3.2 Manual context editing
- [ ] 3.3 Conditional context loading

### Phase 4: Layers & Groups
- [ ] 4.1 Layers in data model
- [ ] 4.2 Layer filters in web
- [ ] 4.3 MCP create_group
- [ ] 4.4 Auto-generated groups
- [ ] 4.5 Group filters in web

### Phase 5: Navigation
- [ ] 5.1 MCP navigation tools
- [ ] 5.2 Web drill-down (Feature → Clusters → Files)
- [ ] 5.3 Search and focus

### Phase 6: Design System
- [ ] 6.1 Design system template
- [ ] 6.2 MCP design system for frontend

### Phase 7: Editor
- [ ] 7.1 Serve command (API + WS + MCP)
- [ ] 7.2 Context editor UI

### Phase 8: Comments
- [ ] 8.1 Comments data structure
- [ ] 8.2 MCP get_feature_comments
- [ ] 8.3 Comments UI

### Phase 9: Bidirectional Sync
- [ ] 9.1 WebSocket live updates
- [ ] 9.2 Edit features in web

### Phase 10: Polish
- [ ] 10.1 Performance optimization
- [ ] 10.2 Improved visualization
- [ ] 10.3 Documentation

---

## Development Rules

### Code Quality
- **MAX 300 lines per file** — split if larger
- **TypeScript + Zod** — types and runtime validation everywhere
- **Pure functions** — no mutations, early returns
- **Composition over inheritance**

### Data Integrity
- **Derived vs Authored** — know which files can be regenerated
- **Respect locks** — never overwrite locked fields
- **ID stability** — cluster/feature IDs must survive rescans
- **Deterministic output** — same input = same YAML output

### AI Interaction
- **AI reads features, not code** — keep feature files informative
- **AI works in steps** — never feed entire codebase
- **Locks protect human edits** — AI checks locks before writing

---

## Key Architectural Decisions

1. **Clusters ≠ Features**
   - Clusters = technical (from parser, folder-based)
   - Features = architectural (from AI, cross-cutting)

2. **YAML over database**
   - Human-readable, git-friendly
   - Easy to edit manually
   - No server required

3. **MCP over custom protocol**
   - Works with Cursor, VS Code, Claude Desktop
   - One server, all platforms

4. **Composition hash**
   - Hash of cluster IDs in a feature
   - Detects when feature needs AI re-review
   - Prevents unnecessary overwrites

5. **Locks on authored files**
   - User can lock specific fields
   - AI must check before modifying
   - Preserves human curation

---

