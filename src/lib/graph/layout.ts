import type { GraphNode, TagCluster } from "./types";

// --- 定数 ---
const CLUSTER_DISTANCE = 280;   // クラスタ中心間の距離（v5: 160 → 拡大）
const NODE_DISTANCE = 80;       // クラスタ内ノード間の配置距離
const KNOWLEDGE_DISTANCE = 50;  // 外部知識のノードからの距離
const BASE_R = 22;              // ノードの基本半径

// --- クラスタ配置 ---
// 決定論的な幾何学配置。force simulation は使わない。
export function layoutTagClusters(
  tags: TagCluster[],
  centerX: number,
  centerY: number,
): TagCluster[] {
  if (tags.length === 0) return [];
  return tags.map((tag, i) => {
    const angleDeg = -90 + (360 / tags.length) * i;
    const rad = (angleDeg * Math.PI) / 180;
    const dist = tags.length <= 3 ? CLUSTER_DISTANCE * 0.8 : CLUSTER_DISTANCE;
    return {
      ...tag,
      x: centerX + dist * Math.cos(rad),
      y: centerY + dist * Math.sin(rad),
      r: Math.max(60, 40 + tag.nodeCount * 12), // v5より大きめ（ノードが中に入る）
    };
  });
}

// --- クラスタ内ノード配置 ---
// クラスタ中心から放射状に全ノードを配置
export function layoutNodesInCluster(
  clusterX: number,
  clusterY: number,
  count: number,
): { x: number; y: number }[] {
  if (count === 0) return [];
  if (count === 1) return [{ x: clusterX, y: clusterY }];
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = -90 + (360 / count) * i;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: clusterX + NODE_DISTANCE * Math.cos(rad),
      y: clusterY + NODE_DISTANCE * Math.sin(rad),
    };
  });
}

// --- 外部知識配置 ---
// フォーカスされたノードの周囲に展開
export function layoutKnowledge(
  nodeX: number,
  nodeY: number,
  count: number,
  existingNodes: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (count === 0) return [];
  const minSep = BASE_R * 2.5;
  for (let attempt = 0; attempt < 3; attempt++) {
    const startAngle = -90 + attempt * 45;
    const dist = KNOWLEDGE_DISTANCE + attempt * 15;
    const positions = Array.from({ length: count }, (_, i) => {
      const angleDeg = startAngle + (360 / count) * i;
      const rad = (angleDeg * Math.PI) / 180;
      return { x: nodeX + dist * Math.cos(rad), y: nodeY + dist * Math.sin(rad) };
    });
    const hasCollision = positions.some((pos) =>
      existingNodes.some((e) => Math.hypot(pos.x - e.x, pos.y - e.y) < minSep)
    );
    if (!hasCollision) return positions;
  }
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = -90 + (360 / count) * i;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: nodeX + (KNOWLEDGE_DISTANCE + 40) * Math.cos(rad),
      y: nodeY + (KNOWLEDGE_DISTANCE + 40) * Math.sin(rad),
    };
  });
}

export function calcNodeRadius(connCount: number): number {
  return Math.min(28, BASE_R + connCount * 2);
}

export { CLUSTER_DISTANCE, NODE_DISTANCE, KNOWLEDGE_DISTANCE, BASE_R };
