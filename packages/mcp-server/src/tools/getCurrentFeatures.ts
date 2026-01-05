import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { findFeaturemapDir } from '../utils/findFeaturemapDir.js';

export interface Feature {
  id: string;
  name: string;
  description: string | null;
  source: 'auto' | 'ai' | 'manual';
  status: 'active' | 'deprecated' | 'ignored';
  files: Array<{ path: string; role?: string }>;
  exports: string[];
  dependsOn: string[];
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

export interface CurrentFeaturesResult {
  success: boolean;
  data?: {
    features: Feature[];
    summary: {
      total: number;
      bySource: { auto: number; ai: number; manual: number };
      byStatus: { active: number; deprecated: number; ignored: number };
    };
  };
  error?: string;
}

export function getCurrentFeatures(projectRoot?: string): CurrentFeaturesResult {
  try {
    const featuremapDir = resolveFeaturemapDir(projectRoot);
    if (!featuremapDir) {
      return {
        success: false,
        error: 'No .featuremap directory found. Run "featuremap init" first.',
      };
    }

    const featuresDir = path.join(featuremapDir, 'features');

    if (!fs.existsSync(featuresDir)) {
      return {
        success: false,
        error: 'features/ directory not found. Run "featuremap scan" first.',
      };
    }

    const files = fs.readdirSync(featuresDir).filter((f) => f.endsWith('.yaml'));
    const features: Feature[] = [];

    for (const file of files) {
      const filePath = path.join(featuresDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const feature = yaml.parse(content) as Feature;
      features.push(feature);
    }

    features.sort((a, b) => a.name.localeCompare(b.name));

    const summary = {
      total: features.length,
      bySource: {
        auto: features.filter((f) => f.source === 'auto').length,
        ai: features.filter((f) => f.source === 'ai').length,
        manual: features.filter((f) => f.source === 'manual').length,
      },
      byStatus: {
        active: features.filter((f) => f.status === 'active').length,
        deprecated: features.filter((f) => f.status === 'deprecated').length,
        ignored: features.filter((f) => f.status === 'ignored').length,
      },
    };

    return {
      success: true,
      data: { features, summary },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function resolveFeaturemapDir(projectRoot?: string): string | null {
  if (projectRoot) {
    const candidate = path.join(projectRoot, '.featuremap');
    return fs.existsSync(candidate) ? candidate : null;
  }

  return findFeaturemapDir();
}
