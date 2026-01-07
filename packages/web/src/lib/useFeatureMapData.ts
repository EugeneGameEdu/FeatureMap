import { useCallback, useEffect, useState } from 'react';
import type { FeatureMapData } from './types';
import { loadComments } from './commentLoader';
import { loadFeatureMap } from './loadFeatureMap';
import { connectFeaturemapWs } from './wsClient';

export function useFeatureMapData() {
  const [data, setData] = useState<FeatureMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const featureMap = await loadFeatureMap();
      setData(featureMap);
    } catch (err) {
      if (showLoading) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } else {
        console.warn('Failed to refresh data:', err);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  const updateLayoutPositions = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      setData((prev) => {
        if (!prev) {
          return prev;
        }
        const nextPositions = { ...prev.layout.positions, ...positions };
        return {
          ...prev,
          layout: {
            ...prev.layout,
            positions: nextPositions,
            metadata: {
              ...prev.layout.metadata,
              updatedAt: new Date().toISOString(),
            },
          },
        };
      });
    },
    []
  );

  const updateGroupNote = useCallback((groupId: string, note: string | null) => {
    setData((prev) => {
      if (!prev) {
        return prev;
      }
      const existing = prev.groupsById[groupId];
      if (!existing) {
        return prev;
      }
      const updatedGroup = buildGroupWithNote(existing, note);
      const updatedGroups = prev.groups.map((group) =>
        group.id === groupId ? updatedGroup : group
      );
      return {
        ...prev,
        groups: updatedGroups,
        groupsById: {
          ...prev.groupsById,
          [groupId]: updatedGroup,
        },
      };
    });
  }, []);

  const refreshComments = useCallback(async () => {
    try {
      const comments = await loadComments();
      setData((prev) => (prev ? { ...prev, comments } : prev));
    } catch (err) {
      console.warn('Failed to refresh comments:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const disconnect = connectFeaturemapWs((message) => {
      if (message.type === 'featuremap_changed') {
        if (message.reason === 'comments_updated' || message.file?.startsWith('comments/')) {
          refreshComments();
          return;
        }
        loadData({ showLoading: false });
      }
    });
    return disconnect;
  }, [loadData, refreshComments]);

  return {
    data,
    error,
    loading,
    loadData,
    updateLayoutPositions,
    updateGroupNote,
  };
}

function buildGroupWithNote(group: FeatureMapData['groups'][number], note: string | null) {
  if (note && note.length > 0) {
    return { ...group, note };
  }
  const { note: _note, ...rest } = group;
  return rest;
}
