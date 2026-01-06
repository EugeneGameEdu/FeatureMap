export interface SearchCluster {
  id: string;
  purpose_hint?: string;
}

export interface SearchFeature {
  id: string;
  name: string;
  description?: string;
  clusters?: SearchCluster[];
}

export interface RankedFeature {
  id: string;
  name: string;
  reason: string;
  score: number;
}

export interface RankOptions {
  maxResults: number;
}

export interface RankResult {
  matches: RankedFeature[];
  totalMatches: number;
  truncated: boolean;
  tokens: string[];
}

const DEFAULT_MAX_RESULTS = 20;

type MatchSource = 'id' | 'name' | 'description' | 'cluster' | 'purpose';

export function rankFeatures(
  query: string,
  features: SearchFeature[],
  options?: Partial<RankOptions>
): RankResult {
  const normalizedQuery = normalizeText(query);
  const tokens = uniqueTokens(tokenize(normalizedQuery));
  const maxResults = options?.maxResults ?? DEFAULT_MAX_RESULTS;

  const scored = features
    .map((feature) => scoreFeature(feature, normalizedQuery, tokens))
    .filter((feature) => feature.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.id.localeCompare(right.id);
    });

  const truncated = scored.length > maxResults;
  const matches = scored.slice(0, maxResults);

  return {
    matches,
    totalMatches: scored.length,
    truncated,
    tokens,
  };
}

function scoreFeature(
  feature: SearchFeature,
  normalizedQuery: string,
  tokens: string[]
): RankedFeature {
  const idText = normalizeText(feature.id);
  const nameText = normalizeText(feature.name);
  const descriptionText = normalizeText(feature.description ?? '');
  const clusterIds = feature.clusters?.map((cluster) => normalizeText(cluster.id)) ?? [];
  const purposeHints =
    feature.clusters?.map((cluster) => normalizeText(cluster.purpose_hint ?? '')) ?? [];

  let score = 0;
  const matches = new Set<MatchSource>();

  if (idText === normalizedQuery && normalizedQuery) {
    score += 10;
    matches.add('id');
  } else if (normalizedQuery && idText.includes(normalizedQuery)) {
    score += 6;
    matches.add('id');
  }

  if (normalizedQuery && nameText.includes(normalizedQuery)) {
    score += 4;
    matches.add('name');
  }

  if (normalizedQuery && descriptionText.includes(normalizedQuery)) {
    score += 2;
    matches.add('description');
  }

  for (const token of tokens) {
    if (idText.includes(token)) {
      score += 3;
      matches.add('id');
    }
    if (nameText.includes(token)) {
      score += 2;
      matches.add('name');
    }
    if (descriptionText.includes(token)) {
      score += 1;
      matches.add('description');
    }
    if (!matches.has('cluster') && clusterIds.some((id) => id.includes(token))) {
      score += 1;
      matches.add('cluster');
    }
    if (!matches.has('purpose') && purposeHints.some((hint) => hint.includes(token))) {
      score += 1;
      matches.add('purpose');
    }
  }

  return {
    id: feature.id,
    name: feature.name,
    reason: buildReason(matches),
    score,
  };
}

function buildReason(matches: Set<MatchSource>): string {
  if (matches.size === 0) {
    return 'no match';
  }

  const parts: string[] = [];
  if (matches.has('id')) parts.push('feature id');
  if (matches.has('name')) parts.push('name');
  if (matches.has('description')) parts.push('description');
  if (matches.has('cluster')) parts.push('cluster id');
  if (matches.has('purpose')) parts.push('cluster purpose');

  if (parts.length === 1) {
    return `matches ${parts[0]}`;
  }

  return `matches ${parts.join(', ')}`;
}

function tokenize(value: string): string[] {
  return value.split(/[^a-z0-9]+/g).filter(Boolean);
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}
