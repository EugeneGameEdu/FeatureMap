# FeatureMap Web UI (Behavior)

## Data Loading

The web UI loads all data from the base URL:

- `/featuremap-data`

Depending on how you run FeatureMap:

- `featuremap serve`: serves `/featuremap-data/*` directly from `.featuremap/`
- `featuremap web`: copies `.featuremap/` into `packages/web/public/featuremap-data/` and then runs Vite

## Views

- **Clusters view:** visualizes cluster dependency edges (technical map).
- **Features view:** visualizes feature dependency edges (architectural map).

Both views are driven by `graph.yaml` node/edge types.

## Groups

Groups are defined in `.featuremap/groups/*.yaml` and enable:

- filtering the visible set
- group containers (visual rectangles around related nodes)

The web UI loads `groups/index.yaml` from `/featuremap-data/groups/index.yaml` (generated on demand if needed).

## Comments

Comments are stored as `.featuremap/comments/*.yaml` and rendered as positioned notes.

The web UI loads `comments/index.yaml` from `/featuremap-data/comments/index.yaml` (generated on demand if needed).

## Editing & Security

Edits happen through the local API exposed by `featuremap serve`.

Mutations require a session token:

- `featuremap serve` prints `Session token: ...`
- The UI uses this token to authenticate edit requests

Current editable surfaces:

- layout (node positions / viewport) -> `layout.yaml`
- project context -> `context/*.yaml`
- group note -> `groups/*.yaml`
- comments -> `comments/*.yaml`

## Live Updates (What It Means)

The WebSocket server (`/ws`) broadcasts when the API writes:

- `context_updated`
- `comments_updated`
- `groups_updated`
- `layout_updated`

It does not automatically broadcast on arbitrary filesystem changes to `.featuremap/`.

