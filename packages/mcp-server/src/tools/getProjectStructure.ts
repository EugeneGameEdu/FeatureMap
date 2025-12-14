import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface ProjectStructureResult {
  success: boolean;
  data?: {
    files: Record<
      string,
      {
        exports: Array<{ name: string; type: string }>;
        imports: { internal: string[]; external: string[] };
        linesOfCode: number;
      }
    >;
    dependencies: Record<string, string[]>;
  };
  error?: string;
}

export function getProjectStructure(projectRoot: string): ProjectStructureResult {
  try {
    const rawGraphPath = path.join(projectRoot, '.featuremap', 'raw-graph.yaml');

    if (!fs.existsSync(rawGraphPath)) {
      return {
        success: false,
        error: 'raw-graph.yaml not found. Run "featuremap scan" first.',
      };
    }

    const content = fs.readFileSync(rawGraphPath, 'utf-8');
    const rawGraph = yaml.parse(content);

    return {
      success: true,
      data: {
        files: rawGraph.files || {},
        dependencies: rawGraph.dependencies || {},
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
