declare module '@dagrejs/dagre' {
  export const graphlib: {
    Graph: new () => Graph;
  };

  export interface Graph {
    setDefaultEdgeLabel(callback: () => object): void;
    setGraph(options: { rankdir?: string; nodesep?: number; ranksep?: number }): void;
    setNode(id: string, options: { width: number; height: number }): void;
    setEdge(source: string, target: string): void;
    node(id: string): { x: number; y: number; width: number; height: number };
  }

  export function layout(graph: Graph): void;
}
