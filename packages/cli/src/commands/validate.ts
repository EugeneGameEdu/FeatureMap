import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import type { ZodType } from 'zod';
import {
  ClusterSchema,
  ConfigSchema,
  FeatureSchema,
  GraphSchema,
  RawGraphSchema,
} from '../types/index.js';
import { loadYAML } from '../utils/yaml-loader.js';

interface ValidationResult {
  file: string;
  valid: boolean;
  errors?: string[];
  skipped?: boolean;
}

interface ValidateOptions {
  quiet?: boolean;
}

function getSchemaForFile(filePath: string, featuremapDir: string): ZodType<unknown> | null {
  const relativePath = path.relative(featuremapDir, filePath).replace(/\\/g, '/');

  if (relativePath === 'config.yaml') {
    return ConfigSchema;
  }

  if (relativePath === 'raw-graph.yaml') {
    return RawGraphSchema;
  }

  if (relativePath === 'graph.yaml') {
    return GraphSchema;
  }

  if (relativePath.startsWith('features/')) {
    return FeatureSchema;
  }

  if (relativePath.startsWith('clusters/')) {
    return ClusterSchema;
  }

  return null;
}

function getRelativePath(featuremapDir: string, filePath: string): string {
  return path.relative(featuremapDir, filePath).replace(/\\/g, '/');
}

function formatErrorMessages(error: unknown): string[] {
  if (error instanceof Error) {
    const lines = error.message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const detailLines = lines
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2));

    if (detailLines.length > 0) {
      return detailLines;
    }

    if (lines.length > 0) {
      return lines;
    }
  }

  return ['Unknown error'];
}

function validateFile(filePath: string, featuremapDir: string): ValidationResult {
  const relativePath = getRelativePath(featuremapDir, filePath);
  const schema = getSchemaForFile(filePath, featuremapDir);

  if (!schema) {
    return {
      file: relativePath,
      valid: true,
      skipped: true,
    };
  }

  try {
    loadYAML(filePath, schema);
    return {
      file: relativePath,
      valid: true,
    };
  } catch (error) {
    return {
      file: relativePath,
      valid: false,
      errors: formatErrorMessages(error),
    };
  }
}

function validateAll(featuremapDir: string): ValidationResult[] {
  const files = fg.sync('**/*.yaml', {
    cwd: featuremapDir,
    absolute: true,
    onlyFiles: true,
  });

  files.sort((left, right) =>
    getRelativePath(featuremapDir, left).localeCompare(getRelativePath(featuremapDir, right))
  );

  return files.map((filePath) => validateFile(filePath, featuremapDir));
}

function countErrors(results: ValidationResult[]): number {
  return results
    .filter((result) => !result.valid && !result.skipped)
    .reduce((total, result) => total + (result.errors?.length ?? 1), 0);
}

function printValidationResults(
  results: ValidationResult[],
  quiet: boolean
): void {
  const validated = results.filter((result) => !result.skipped);
  const invalid = validated.filter((result) => !result.valid);

  if (!quiet) {
    console.log('Validating .featuremap/...\n');
  }

  if (validated.length === 0) {
    if (!quiet) {
      for (const result of results.filter((entry) => entry.skipped)) {
        console.log(`Warning: Skipping unknown file: ${result.file}`);
      }
      console.log('✓ No files to validate');
    }
    return;
  }

  for (const result of results) {
    if (result.skipped) {
      if (!quiet) {
        console.log(`Warning: Skipping unknown file: ${result.file}`);
      }
      continue;
    }

    if (result.valid) {
      if (!quiet) {
        console.log(`  ✓ ${result.file}`);
      }
      continue;
    }

    console.log(`  ✗ ${result.file}`);
    for (const error of result.errors ?? ['Unknown error']) {
      console.log(`    - ${error}`);
    }
  }

  if (invalid.length === 0) {
    if (!quiet) {
      console.log(`\n✓ All ${validated.length} files valid`);
    }
    return;
  }

  const errorCount = countErrors(results);
  console.log(
    `\n✗ Found ${errorCount} errors in ${invalid.length} of ${validated.length} files`
  );
}

export function validateCommand(options: ValidateOptions): void {
  const projectRoot = process.cwd();
  const featuremapDir = path.join(projectRoot, '.featuremap');
  const quiet = options.quiet === true;

  if (!fs.existsSync(featuremapDir)) {
    console.error('❌ .featuremap/ not found. Run "featuremap init" first.');
    process.exit(1);
  }

  const results = validateAll(featuremapDir);
  const hasErrors = results.some((result) => !result.valid && !result.skipped);

  printValidationResults(results, quiet);

  if (hasErrors) {
    process.exitCode = 1;
  }
}
