import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FeatureMapData, ViewMode } from './types';
import { buildGroupMembers, buildPrimaryGroupMembership } from './groupMembership';

interface UseGroupSelectionInput {
  data: FeatureMapData | null;
  viewMode: ViewMode;
  selectedGroupId: string;
  visibleNodeIds: Set<string>;
  groupMembership?: Map<string, string[]>;
  multiGroupNodeIds?: string[];
}

export function useGroupSelection({
  data,
  viewMode,
  selectedGroupId,
  visibleNodeIds,
  groupMembership: groupMembershipOverride,
  multiGroupNodeIds: multiGroupNodeIdsOverride,
}: UseGroupSelectionInput) {
  const [selectedGroupDetailsId, setSelectedGroupDetailsId] = useState<string | null>(null);
  const computedMembership = useMemo(() => {
    if (!data) {
      return { membership: new Map<string, string[]>(), multiGroupNodeIds: [] };
    }
    return buildPrimaryGroupMembership(data.groups, data.entities, viewMode);
  }, [data, viewMode]);
  const groupMembership = groupMembershipOverride ?? computedMembership.membership;
  const multiGroupNodeIds = multiGroupNodeIdsOverride ?? computedMembership.multiGroupNodeIds;
  const selectedGroupDetails = useMemo(() => {
    if (!selectedGroupDetailsId || !data) {
      return null;
    }
    return data.groupsById[selectedGroupDetailsId] ?? null;
  }, [data, selectedGroupDetailsId]);
  const selectedGroupMembers = useMemo(() => {
    if (!selectedGroupDetails || !data) {
      return [];
    }
    return buildGroupMembers(selectedGroupDetails, data.entities, viewMode);
  }, [data, selectedGroupDetails, viewMode]);
  const clearGroupSelection = useCallback(() => {
    setSelectedGroupDetailsId(null);
  }, []);
  const selectGroup = useCallback((groupId: string) => {
    setSelectedGroupDetailsId(groupId);
  }, []);

  useEffect(() => {
    if (!selectedGroupDetailsId) {
      return;
    }
    if (!data?.groupsById[selectedGroupDetailsId]) {
      setSelectedGroupDetailsId(null);
      return;
    }
    if (selectedGroupId !== 'all' && selectedGroupDetailsId !== selectedGroupId) {
      setSelectedGroupDetailsId(null);
      return;
    }
    const memberIds = groupMembership.get(selectedGroupDetailsId) ?? [];
    const hasVisibleMembers = memberIds.some((id) => visibleNodeIds.has(id));
    if (!hasVisibleMembers) {
      setSelectedGroupDetailsId(null);
    }
  }, [data, groupMembership, selectedGroupDetailsId, selectedGroupId, visibleNodeIds]);

  return {
    clearGroupSelection,
    selectGroup,
    selectedGroupDetails,
    selectedGroupDetailsId,
    selectedGroupMembers,
    groupMembership,
    multiGroupNodeIds,
  };
}
