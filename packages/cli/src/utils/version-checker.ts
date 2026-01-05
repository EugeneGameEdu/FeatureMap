import {
  MIN_SUPPORTED_VERSIONS,
  SUPPORTED_VERSIONS,
  type FileType,
} from '../constants/versions.js';

export interface VersionCheckResult {
  valid: boolean;
  fileVersion: number | undefined;
  supportedVersion: number;
  minVersion: number;
  error?: 'missing' | 'too_old' | 'too_new';
  message?: string;
}

export class VersionCheckError extends Error {
  readonly result: VersionCheckResult;

  constructor(result: VersionCheckResult) {
    super(result.message ?? 'Version check failed.');
    this.name = 'VersionCheckError';
    this.result = result;
  }
}

export function checkVersion(
  fileType: FileType,
  fileVersion: number | undefined
): VersionCheckResult {
  const supported = SUPPORTED_VERSIONS[fileType];
  const min = MIN_SUPPORTED_VERSIONS[fileType];

  if (fileVersion === undefined) {
    return {
      valid: false,
      fileVersion: undefined,
      supportedVersion: supported,
      minVersion: min,
      error: 'missing',
      message: `Missing version field. Expected version: ${supported}. Add "version: ${supported}" or run "featuremap scan".`,
    };
  }

  if (fileVersion < min) {
    return {
      valid: false,
      fileVersion,
      supportedVersion: supported,
      minVersion: min,
      error: 'too_old',
      message: `Version ${fileVersion} is too old. Minimum supported: ${min}. Run "featuremap scan" or "featuremap migrate" when available.`,
    };
  }

  if (fileVersion > supported) {
    return {
      valid: false,
      fileVersion,
      supportedVersion: supported,
      minVersion: min,
      error: 'too_new',
      message: `Version ${fileVersion} is newer than supported (${supported}). Update your CLI: npm update featuremap`,
    };
  }

  return {
    valid: true,
    fileVersion,
    supportedVersion: supported,
    minVersion: min,
  };
}
