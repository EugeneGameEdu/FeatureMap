export const KEY_ORDER: Record<string, string[]> = {
  config: ['version', 'project', 'scan', 'features'],
  cluster: [
    'version',
    'id',
    'layer',
    'layerDetection',
    'files',
    'exports',
    'imports',
    'purpose_hint',
    'entry_points',
    'compositionHash',
    'metadata',
  ],
  feature: [
    'version',
    'id',
    'name',
    'description',
    'purpose',
    'source',
    'status',
    'scope',
    'clusters',
    'dependsOn',
    'composition',
    'locks',
    'metadata',
    'reasoning',
  ],
  group: [
    'version',
    'id',
    'name',
    'description',
    'featureIds',
    'source',
    'locks',
    'metadata',
  ],
  comment: [
    'version',
    'id',
    'content',
    'position',
    'links',
    'tags',
    'priority',
    'author',
    'createdAt',
    'updatedAt',
  ],
  graph: ['version', 'generatedAt', 'nodes', 'edges'],
  layout: ['version', 'positions', 'viewport', 'metadata'],
};

export function getKeyComparator(type: string): (a: string, b: string) => number {
  const order = KEY_ORDER[type] ?? [];
  const indexByKey = new Map(order.map((key, index) => [key, index]));

  return (a: string, b: string): number => {
    const indexA = indexByKey.get(a);
    const indexB = indexByKey.get(b);

    if (indexA !== undefined && indexB !== undefined) {
      return indexA - indexB;
    }

    if (indexA !== undefined) {
      return -1;
    }

    if (indexB !== undefined) {
      return 1;
    }

    return a.localeCompare(b);
  };
}
