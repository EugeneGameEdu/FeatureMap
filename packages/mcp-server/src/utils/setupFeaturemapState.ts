import * as fs from 'fs';
import * as path from 'path';

export interface ProjectState {
  hasConfig: boolean;
  clustersCount: number;
  featuresCount: number;
  groupsCount: number;
}

export function checkProjectState(featuremapDir: string): ProjectState {
  return {
    hasConfig: fs.existsSync(path.join(featuremapDir, 'config.yaml')),
    clustersCount: countYamlFiles(path.join(featuremapDir, 'clusters')),
    featuresCount: countYamlFiles(path.join(featuremapDir, 'features')),
    groupsCount: countYamlFiles(path.join(featuremapDir, 'groups')),
  };
}

function countYamlFiles(dirPath: string): number {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  try {
    return fs.readdirSync(dirPath).filter((file) => file.endsWith('.yaml')).length;
  } catch {
    return 0;
  }
}
