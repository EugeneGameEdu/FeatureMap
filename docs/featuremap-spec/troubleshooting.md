# Troubleshooting

## “Web shows old UI”

- Rebuild web dist: `npm run build --workspace=@featuremap/web`

## “I can’t edit / Forbidden / token missing”

- Start with `featuremap serve` and copy the printed `Session token: ...` into the UI when prompted.
- The API and WebSocket are localhost-only.

## “Groups not loading”

- Ensure `.featuremap/groups/*.yaml` exists.
- Group index is fetched from `/featuremap-data/groups/index.yaml`:
  - `featuremap serve` can generate it on-demand
  - `featuremap web` generates it during the copy step

## “Comments not loading”

- Ensure `.featuremap/comments/*.yaml` exists.
- Comment index is fetched from `/featuremap-data/comments/index.yaml` (same generation rules as groups).

## “Features disappeared after scan”

`featuremap scan` rebuilds `graph.yaml` for clusters. If your feature nodes are missing in `graph.yaml`, the features view may look empty even if `.featuremap/features/*.yaml` still exists.

- Re-run AI grouping and call `save_features_from_grouping` to rebuild the feature overlay in `graph.yaml`.

## “No verbose scan output”

`featuremap scan --verbose` is not implemented. Use plain `featuremap scan` and check the printed subproject/file counts.

## “Port already in use”

- Windows: `taskkill /IM node.exe /F`

## “Go files not detected”

- Ensure a `go.mod` exists in the Go subproject root.

