export const SUPPORTED_VERSIONS = {
  config: 1,
  rawGraph: 1,
  graph: 1,
  feature: 1,
  cluster: 1,
  group: 1,
  comment: 1,
  context: 1,
} as const;

export const MIN_SUPPORTED_VERSIONS = {
  config: 1,
  rawGraph: 1,
  graph: 1,
  feature: 1,
  cluster: 1,
  group: 1,
  comment: 1,
  context: 1,
} as const;

export type FileType = keyof typeof SUPPORTED_VERSIONS;
