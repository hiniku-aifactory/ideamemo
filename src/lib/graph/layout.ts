import type { GraphNode, TagCluster } from "./types";

const IDEA_DISTANCE = 140;
const KNOWLEDGE_DISTANCE = 100;
const BASE_R = 22;
const TAG_CLUSTER_DISTANCE = 160;

export function layoutTagClusters(
  tags: TagCluster[],
  centerX: number,
  centerY: number,
): TagCluster[] {
  if (tags.length === 0) return [];
  return tags.map((tag, i) => {
    const angleDeg = -90 + (360 / tags.length) * i;
    const rad = (angleDeg * Math.PI) / 180;
    const dist = tags.length <= 3 ? TAG_CLUSTER_DISTANCE * 0.8 : TAG_CLUSTER_DISTANCE;
    return {
      ...tag,
      x: centerX + dist * Math.cos(rad),
      y: centerY + dist * Math.sin(rad),
      r: Math.max(40, 30 + tag.nodeCount * 6),
    };
  });
}

export function layoutSatellites(
  centerX: number,
  centerY: number,
  count: number,
  distance: number,
  startAngleDeg: number = -90
): { x: number; y: number }[] {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = startAngleDeg + (360 / count) * i;
    const rad = (angleDeg * Math.PI) / 180;
    return {
      x: centerX + distance * Math.cos(rad),
      y: centerY + distance * Math.sin(rad),
    };
  });
}

export function layoutWithCollisionAvoidance(
  centerX: number,
  centerY: number,
  count: number,
  distance: number,
  existingNodes: GraphNode[]
): { x: number; y: number }[] {
  const minSeparation = BASE_R * 3;

  for (let attempt = 0; attempt < 3; attempt++) {
    const startAngle = -90 + attempt * 30;
    const extraDist = attempt * 20;
    const positions = layoutSatellites(
      centerX,
      centerY,
      count,
      distance + extraDist,
      startAngle
    );

    const hasCollision = positions.some((pos) =>
      existingNodes.some((existing) => {
        const dx = pos.x - existing.x;
        const dy = pos.y - existing.y;
        return Math.hypot(dx, dy) < minSeparation;
      })
    );

    if (!hasCollision) return positions;
  }

  return layoutSatellites(centerX, centerY, count, distance + 60, -90);
}

export function calcNodeRadius(connCount: number): number {
  return Math.min(28, BASE_R + connCount * 2);
}

export { IDEA_DISTANCE, KNOWLEDGE_DISTANCE, BASE_R };
