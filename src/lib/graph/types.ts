import type { ConnectionType } from "@/lib/types";

export interface GraphNode {
  id: string;
  summary: string;
  graphLabel: string;
  keywords: string[];
  tags: string[];
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

export interface TagCluster {
  tag: string;
  nodeCount: number;
  ideaIds: string[];
  x: number;
  y: number;
  r: number;
}
