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
  LayoutSchema,
} from '../types/index.js';
import type { FileType } from '../constants/versions.js';
import { loadYAML } from '../utils/yaml-loader.js';
import { VersionCheckError } from '../utils/version-checker.js';

type ValidationStatus = 'valid' | 'warning' | 'error' | 'skipped';

interface ValidationResult {
  file: string;
  status: ValidationStatus;
  messages?: string[];
  version?: number;
}

interface ValidateOptions {
  quiet?: boolean;
}

interface SchemaTarget {
  schema: ZodType<unknown>;
  fileType: FileType;
}

function getSchemaForFile(filePath: string, featuremapDir: string): SchemaTarget | null {
  const relativePath = path.relative(featuremapDir, filePath).replace(/\\/g, '/');

  if (relativePath === 'config.yaml') {
    return { schema: ConfigSchema, fileType: 'config' };
  }

  if (relativePath === 'raw-graph.yaml') {
    return { schema: RawGraphSchema, fileType: 'rawGraph' };
  }

  if (relativePath === 'graph.yaml') {
    return { schema: GraphSchema, fileType: 'graph' };
  }

  if (relativePath === 'layout.yaml') {
    return { schema: LayoutSchema, fileType: 'layout' };
  }

  if (relativePath.startsWith('features/')) {
    return { schema: FeatureSchema, fileType: 'feature' };
  }

  if (relativePath.startsWith('clusters/')) {
    return { schema: ClusterSchema, fileType: 'cluster' };
  }

  return null;
}

function getRelativePath(featuremapDir: string, filePath: string): string {
  return path.relative(featuremapDir, filePath).replace(/\\/g, '/');
}

function getVersionValue(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (!('version' in value)) {
    return undefined;
  }

  const version = (value as { version?: unknown }).version;
  return typeof version === 'number' && Number.isFinite(version) ? version : undefined;
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
  const target = getSchemaForFile(filePath, featuremapDir);

  if (!target) {
    return {
      file: relativePath,
      status: 'skipped',
    };
  }

  try {
    const data = loadYAML(filePath, target.schema, { fileType: target.fileType });
    const version = getVersionValue(data);
    return {
      file: relativePath,
      status: 'valid',
      version,
    };
  } catch (error) {
    if (error instanceof VersionCheckError) {
      const status = error.result.error === 'too_new' ? 'warning' : 'error';
      return {
        file: relativePath,
        status,
        version: error.result.fileVersion,
        messages: [error.result.message ?? 'Version check failed.'],
      };
    }

    return {
      file: relativePath,
      status: 'error',
      messages: formatErrorMessages(error),
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

function countMessages(results: ValidationResult[], status: ValidationStatus): number {
  return results
    .filter((result) => result.status === status)
    .reduce((total, result) => total + (result.messages?.length ?? 1), 0);
}

function printValidationResults(results: ValidationResult[], quiet: boolean): void {
  const validated = results.filter((result) => result.status !== 'skipped');
  const errors = results.filter((result) => result.status === 'error');
  const warnings = results.filter((result) => result.status === 'warning');

  if (!quiet) {
    console.log('Validating .featuremap/...\n');
  }

  if (validated.length === 0) {
    if (!quiet) {
      for (const result of results.filter((entry) => entry.status === 'skipped')) {
        console.log(`Warning: Skipping unknown file: ${result.file}`);
      }
      console.log('✓ No files to validate');
    }
    return;
  }

  for (const result of results) {
    if (result.status === 'skipped') {
      if (!quiet) {
        console.log(`Warning: Skipping unknown file: ${result.file}`);
      }
      continue;
    }

    if (result.status === 'valid') {
      if (!quiet) {
        const versionLabel = result.version !== undefined ? ` (v${result.version})` : '';
        console.log(`  ✓ ${result.file}${versionLabel}`);
      }
      continue;
    }

    if (result.status === 'warning') {
      if (!quiet) {
        console.log(`  ⚠ ${result.file}`);
        for (const message of result.messages ?? ['Unknown warning']) {
          console.log(`    - ${message}`);
        }
      }
      continue;
    }

    console.log(`  ✗ ${result.file}`);
    for (const message of result.messages ?? ['Unknown error']) {
      console.log(`    - ${message}`);
    }
  }

  const errorCount = countMessages(results, 'error');
  const warningCount = countMessages(results, 'warning');

  if (quiet) {
    if (errorCount > 0) {
      const errorSuffix = errorCount === 1 ? '' : 's';
      console.log(`\n✗ Found ${errorCount} error${errorSuffix} in ${validated.length} files`);
    }
    return;
  }

  if (errorCount === 0 && warningCount === 0) {
    console.log(`\n✓ All ${validated.length} files valid`);
    return;
  }

  if (errorCount > 0) {
    const errorSuffix = errorCount === 1 ? '' : 's';
    const warningSuffix = warningCount === 1 ? '' : 's';
    const warningPart = warningCount > 0 ? `, ${warningCount} warning${warningSuffix}` : '';
    console.log(`\n✗ Found ${errorCount} error${errorSuffix}${warningPart} in ${validated.length} files`);
    return;
  }

  const warningSuffix = warningCount === 1 ? '' : 's';
  console.log(`\n⚠ Found ${warningCount} warning${warningSuffix} in ${validated.length} files`);
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
  const hasErrors = results.some((result) => result.status === 'error');

  printValidationResults(results, quiet);

  if (hasErrors) {
    process.exitCode = 1;
  }
}
