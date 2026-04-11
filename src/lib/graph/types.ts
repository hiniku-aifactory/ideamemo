import type { ConnectionType } from "@/lib/types";

export interface GraphNode {
  id: string;
  summary: string;
  keywords: string[];
  created_at: string;
  r: number;
  x: number;
  y: number;
  isKnowledge: boolean;
  knowledgeTitle?: string;
  knowledgeDescription?: string;
  knowledgeUrl?: string | null;
  parentIdeaId?: string;
  connectionType?: ConnectionType;
  connCount: number;
}

export interface GraphLink {
  id: string;
  sourceId: string;
  targetId: string;
  connectionType: ConnectionType | "knowledge_link";
}

export interface ExploreState {
  centerNodeId: string;
  expandedNodeIds: Set<string>;
  nodePositions: Map<string, { x: number; y: number }>;
  visibleNodes: GraphNode[];
  visibleLinks: GraphLink[];
}
