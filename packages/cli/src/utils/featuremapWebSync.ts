import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { stringify } from 'yaml';

export function findWebPackagePath(): string | null {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const monorepoPath = path.resolve(__dirname, '..', '..', '..', 'web');
  if (fs.existsSync(path.join(monorepoPath, 'package.json'))) {
    return monorepoPath;
  }

  try {
    const require = createRequire(import.meta.url);
    const resolved = require.resolve('@featuremap/web/package.json');
    return path.dirname(resolved);
  } catch {
    // ignore
  }

  const nodeModulesPath = path.resolve(__dirname, '..', '..', 'node_modules', '@featuremap', 'web');
  if (fs.existsSync(path.join(nodeModulesPath, 'package.json'))) {
    return nodeModulesPath;
  }

  return null;
}

export async function copyFeatureMapData(
  sourceDir: string,
  targetDir: string
): Promise<void> {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const graphSource = path.join(sourceDir, 'graph.yaml');
  const graphTarget = path.join(targetDir, 'graph.yaml');
  if (fs.existsSync(graphSource)) {
    fs.copyFileSync(graphSource, graphTarget);
  }

  const layoutSource = path.join(sourceDir, 'layout.yaml');
  const layoutTarget = path.join(targetDir, 'layout.yaml');
  if (fs.existsSync(layoutSource)) {
    fs.copyFileSync(layoutSource, layoutTarget);
  }

  const featuresSource = path.join(sourceDir, 'features');
  const featuresTarget = path.join(targetDir, 'features');

  if (fs.existsSync(featuresSource)) {
    if (fs.existsSync(featuresTarget)) {
      fs.rmSync(featuresTarget, { recursive: true });
    }
    fs.mkdirSync(featuresTarget, { recursive: true });

    const files = fs.readdirSync(featuresSource);
    for (const file of files) {
      if (file.endsWith('.yaml')) {
        fs.copyFileSync(path.join(featuresSource, file), path.join(featuresTarget, file));
      }
    }
  }

  const clustersSource = path.join(sourceDir, 'clusters');
  const clustersTarget = path.join(targetDir, 'clusters');

  if (fs.existsSync(clustersSource)) {
    if (fs.existsSync(clustersTarget)) {
      fs.rmSync(clustersTarget, { recursive: true });
    }
    fs.mkdirSync(clustersTarget, { recursive: true });

    const files = fs.readdirSync(clustersSource);
    for (const file of files) {
      if (file.endsWith('.yaml')) {
        fs.copyFileSync(path.join(clustersSource, file), path.join(clustersTarget, file));
      }
    }
  }

  const commentsSource = path.join(sourceDir, 'comments');
  const commentsTarget = path.join(targetDir, 'comments');

  if (fs.existsSync(commentsSource)) {
    if (fs.existsSync(commentsTarget)) {
      fs.rmSync(commentsTarget, { recursive: true });
    }
    fs.mkdirSync(commentsTarget, { recursive: true });

    const files = fs.readdirSync(commentsSource).filter((file) => file.endsWith('.yaml'));
    const commentIds = files
      .filter((file) => file !== 'index.yaml')
      .map((file) => path.basename(file, '.yaml'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      if (file !== 'index.yaml') {
        fs.copyFileSync(path.join(commentsSource, file), path.join(commentsTarget, file));
      }
    }

    const indexContent = stringify({ version: 1, comments: commentIds }, { lineWidth: 0 });
    fs.writeFileSync(path.join(commentsTarget, 'index.yaml'), indexContent, 'utf-8');
  } else if (fs.existsSync(commentsTarget)) {
    fs.rmSync(commentsTarget, { recursive: true });
  }

  const groupsSource = path.join(sourceDir, 'groups');
  const groupsTarget = path.join(targetDir, 'groups');

  if (fs.existsSync(groupsSource)) {
    if (fs.existsSync(groupsTarget)) {
      fs.rmSync(groupsTarget, { recursive: true });
    }
    fs.mkdirSync(groupsTarget, { recursive: true });

    const files = fs.readdirSync(groupsSource).filter((file) => file.endsWith('.yaml'));
    const groupIds = files
      .map((file) => path.basename(file, '.yaml'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      fs.copyFileSync(path.join(groupsSource, file), path.join(groupsTarget, file));
    }

    const indexContent = stringify({ version: 1, groups: groupIds }, { lineWidth: 0 });
    fs.writeFileSync(path.join(groupsTarget, 'index.yaml'), indexContent, 'utf-8');
  } else if (fs.existsSync(groupsTarget)) {
    fs.rmSync(groupsTarget, { recursive: true });
  }
}
