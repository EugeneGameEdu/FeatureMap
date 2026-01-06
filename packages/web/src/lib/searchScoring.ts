import { normalizeText, tokenize, type SearchIndexEntry, type SearchResultType } from './searchIndex';

const TYPE_ORDER: Record<SearchResultType, number> = {
  feature: 0,
  cluster: 1,
  file: 2,
};

export function rankSearchResults(
  entries: SearchIndexEntry[],
  query: string,
  limit = 20
): SearchIndexEntry[] {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < 2) {
    return [];
  }
  const queryTokens = tokenize(normalizedQuery);

  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreEntry(entry, normalizedQuery, queryTokens),
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => compareResults(a, b))
    .slice(0, limit)
    .map((result) => result.entry);

  return scored;
}

function scoreEntry(
  entry: SearchIndexEntry,
  normalizedQuery: string,
  queryTokens: string[]
): number {
  if (entry.prefixFields.some((field) => field.startsWith(normalizedQuery))) {
    return 300;
  }

  if (entry.fields.some((field) => field.includes(normalizedQuery))) {
    return 200;
  }

  let tokenMatches = 0;
  for (const token of queryTokens) {
    if (entry.tokenSet.has(token)) {
      tokenMatches += 1;
    }
  }

  return tokenMatches > 0 ? 100 + tokenMatches : 0;
}

function compareResults(
  a: { entry: SearchIndexEntry; score: number },
  b: { entry: SearchIndexEntry; score: number }
): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  const typeDiff = TYPE_ORDER[a.entry.type] - TYPE_ORDER[b.entry.type];
  if (typeDiff !== 0) {
    return typeDiff;
  }

  const titleDiff = a.entry.title.localeCompare(b.entry.title);
  if (titleDiff !== 0) {
    return titleDiff;
  }

  return a.entry.id.localeCompare(b.entry.id);
}
