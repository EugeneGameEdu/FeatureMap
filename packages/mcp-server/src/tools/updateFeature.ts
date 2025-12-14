import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface UpdateFeatureParams {
  id: string;
  name?: string;
  description?: string;
  status?: 'active' | 'deprecated' | 'ignored';
}

export interface UpdateFeatureResult {
  success: boolean;
  data?: {
    feature: {
      id: string;
      name: string;
      description: string | null;
      source: string;
      status: string;
    };
    changes: string[];
  };
  error?: string;
}

export function updateFeature(
  projectRoot: string,
  params: UpdateFeatureParams
): UpdateFeatureResult {
  try {
    const { id, name, description, status } = params;

    if (!id) {
      return {
        success: false,
        error: 'Feature ID is required.',
      };
    }

    const featurePath = path.join(projectRoot, '.featuremap', 'features', `${id}.yaml`);

    if (!fs.existsSync(featurePath)) {
      return {
        success: false,
        error: `Feature "${id}" not found.`,
      };
    }

    const content = fs.readFileSync(featurePath, 'utf-8');
    const feature = yaml.parse(content);

    const changes: string[] = [];

    if (name !== undefined && name !== feature.name) {
      changes.push(`name: "${feature.name}" → "${name}"`);
      feature.name = name;
    }

    if (description !== undefined && description !== feature.description) {
      const oldDesc = feature.description || '(empty)';
      const newDesc = description || '(empty)';
      changes.push(`description: "${oldDesc}" → "${newDesc}"`);
      feature.description = description;
    }

    if (status !== undefined && status !== feature.status) {
      changes.push(`status: "${feature.status}" → "${status}"`);
      feature.status = status;
    }

    if (changes.length > 0) {
      feature.source = 'ai';
      feature.metadata = feature.metadata || {};
      feature.metadata.updatedAt = new Date().toISOString();

      fs.writeFileSync(featurePath, yaml.stringify(feature), 'utf-8');

      updateGraphYaml(projectRoot, id, name);
    }

    return {
      success: true,
      data: {
        feature: {
          id: feature.id,
          name: feature.name,
          description: feature.description,
          source: feature.source,
          status: feature.status,
        },
        changes: changes.length > 0 ? changes : ['No changes made'],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function updateGraphYaml(projectRoot: string, featureId: string, newName?: string): void {
  if (!newName) return;

  const graphPath = path.join(projectRoot, '.featuremap', 'graph.yaml');

  if (!fs.existsSync(graphPath)) return;

  try {
    const content = fs.readFileSync(graphPath, 'utf-8');
    const graph = yaml.parse(content);

    if (graph.nodes) {
      const node = graph.nodes.find((n: { id: string }) => n.id === featureId);
      if (node) {
        node.label = newName;
      }
    }

    graph.generatedAt = new Date().toISOString();

    fs.writeFileSync(graphPath, yaml.stringify(graph), 'utf-8');
  } catch {
    // ignore update errors
  }
}
