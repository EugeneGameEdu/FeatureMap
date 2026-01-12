import { useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import type { Connection, EdgeChange, Node, NodeChange } from '@xyflow/react';
import {
  applyGroupDragChanges,
  collectMemberPositions,
  getGroupIdFromContainer,
  type GroupDragStateEntry,
} from './groupDrag';
import { GROUP_CONTAINER_NODE_TYPE } from './groupContainers';

interface UseFlowHandlersInput {
  isReadOnly: boolean;
  groupMembership?: Map<string, string[]>;
  groupDragStateRef: React.MutableRefObject<Map<string, GroupDragStateEntry>>;
  nodesRef: React.MutableRefObject<Node[]>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onEdgeRemove?: (edgeId: string) => void;
  onNodeRemove?: (nodeId: string) => void;
  onNodeClick?: (nodeId: string) => void;
  onNodeDragStop?: (node: Node) => void;
  onGroupDragStop?: (positions: Record<string, { x: number; y: number }>) => void;
  onPaneClick?: (event: ReactMouseEvent) => void;
  onConnect?: (connection: Connection) => void;
}

export function useFlowHandlers({
  isReadOnly,
  groupMembership,
  groupDragStateRef,
  nodesRef,
  setNodes,
  onEdgesChange,
  onEdgeRemove,
  onNodeRemove,
  onNodeClick,
  onNodeDragStop,
  onGroupDragStop,
  onPaneClick,
  onConnect,
}: UseFlowHandlersInput) {
  const handleNodeClick = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      if (node.type === GROUP_CONTAINER_NODE_TYPE) {
        return;
      }
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handleNodeDragStart = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      if (node.type === GROUP_CONTAINER_NODE_TYPE) {
        return;
      }
      onNodeClick?.(node.id);
    },
    [onNodeClick]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const nextChanges = isReadOnly
        ? changes.filter((change) => change.type !== 'remove')
        : changes;
      if (nextChanges.length > 0) {
        onEdgesChange(nextChanges);
      }
      if (isReadOnly || !onEdgeRemove) {
        return;
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          onEdgeRemove(change.id);
        }
      }
    },
    [isReadOnly, onEdgeRemove, onEdgesChange]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => {
        const nextChanges = isReadOnly
          ? changes.filter((change) => change.type !== 'remove' && change.type !== 'position')
          : changes;
        const nextNodes = applyGroupDragChanges(
          nextChanges,
          currentNodes,
          groupMembership ?? new Map(),
          groupDragStateRef.current
        );
        nodesRef.current = nextNodes;
        return nextNodes;
      });
      if (isReadOnly || !onNodeRemove) {
        return;
      }
      for (const change of changes) {
        if (change.type === 'remove') {
          onNodeRemove(change.id);
        }
      }
    },
    [groupMembership, isReadOnly, onNodeRemove, setNodes, nodesRef, groupDragStateRef]
  );

  const handleNodeDragStop = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      if (isReadOnly) {
        return;
      }
      if (node.type === GROUP_CONTAINER_NODE_TYPE) {
        const groupId = getGroupIdFromContainer(node.id);
        if (!groupId || !onGroupDragStop) {
          return;
        }
        const memberIds = groupMembership?.get(groupId) ?? [];
        const positions = collectMemberPositions(nodesRef.current, memberIds);
        groupDragStateRef.current.delete(groupId);
        onGroupDragStop(positions);
        return;
      }
      onNodeDragStop?.(node);
    },
    [groupMembership, isReadOnly, onGroupDragStop, onNodeDragStop, nodesRef, groupDragStateRef]
  );

  const handlePaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (isReadOnly) {
        return;
      }
      onPaneClick?.(event);
    },
    [isReadOnly, onPaneClick]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isReadOnly) {
        return;
      }
      onConnect?.(connection);
    },
    [isReadOnly, onConnect]
  );

  return {
    handleNodeClick,
    handleNodeDragStart,
    handleEdgesChange,
    handleNodesChange,
    handleNodeDragStop,
    handlePaneClick,
    handleConnect,
  };
}
