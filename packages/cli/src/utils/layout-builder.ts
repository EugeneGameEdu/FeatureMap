import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import type { Layout } from '../types/layout.js';

export function buildDefaultLayout(nodeIds: string[]): Layout {
  const positions: Layout['positions'] = {};
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodeIds.length)));
  const spacingX = 260;
  const spacingY = 180;

  nodeIds.forEach((id, index) => {
    positions[id] = {
      x: (index % columns) * spacingX,
      y: Math.floor(index / columns) * spacingY,
    };
  });

  return {
    version: SUPPORTED_VERSIONS.layout,
    positions,
    metadata: {
      updatedAt: new Date().toISOString(),
    },
  };
}
