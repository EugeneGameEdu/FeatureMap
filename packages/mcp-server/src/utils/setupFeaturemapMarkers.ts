export function detectMarkerNotes(markerSet: Set<string>): string[] {
  const notes: string[] = [];
  if (hasMarkerPrefix(markerSet, 'next.config.')) {
    notes.push('Next.js project');
  }
  if (hasMarkerPrefix(markerSet, 'nuxt.config.')) {
    notes.push('Nuxt.js project');
  }
  if (hasMarkerPrefix(markerSet, 'vite.config.')) {
    notes.push('Vite project');
  }
  if (hasMarkerPrefix(markerSet, 'astro.config.')) {
    notes.push('Astro project');
  }
  if (markerSet.has('go.mod')) {
    notes.push('Go module');
  }
  if (markerSet.has('cargo.toml')) {
    notes.push('Rust project (not supported)');
  }
  if (markerSet.has('pyproject.toml')) {
    notes.push('Python project (not supported)');
  }
  return notes;
}

function hasMarkerPrefix(markerSet: Set<string>, prefix: string): boolean {
  for (const marker of markerSet) {
    if (marker.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}
