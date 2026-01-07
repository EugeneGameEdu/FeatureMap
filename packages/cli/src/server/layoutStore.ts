import * as fs from 'fs';
import * as path from 'path';
import { SUPPORTED_VERSIONS } from '../constants/versions.js';
import { LayoutSchema, type Layout } from '../types/index.js';
import { loadYAML, saveYAML } from '../utils/yaml-loader.js';

export interface LayoutPositionsUpdate {
  positions: Record<string, { x: number; y: number }>;
}

export function updateLayoutPositions(
  projectRoot: string,
  update: LayoutPositionsUpdate
): Layout {
  const featuremapDir = path.resolve(projectRoot, '.featuremap');
  const layoutPath = path.resolve(featuremapDir, 'layout.yaml');

  if (!fs.existsSync(featuremapDir)) {
    throw new Error('Missing .featuremap/ directory.');
  }

  const existing = loadLayoutSafe(layoutPath);
  const positions = { ...existing.positions, ...update.positions };
  const next: Layout = {
    ...existing,
    positions,
    metadata: {
      ...existing.metadata,
      updatedAt: new Date().toISOString(),
    },
  };

  saveYAML(layoutPath, next, LayoutSchema);
  return next;
}

function loadLayoutSafe(layoutPath: string): Layout {
  if (!fs.existsSync(layoutPath)) {
    return {
      version: SUPPORTED_VERSIONS.layout,
      positions: {},
      metadata: {
        updatedAt: new Date().toISOString(),
      },
    };
  }

  return loadYAML(layoutPath, LayoutSchema, { fileType: 'layout' });
}
