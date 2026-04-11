import type { Idea, Connection } from "@/lib/types";

const SESSION_KEY = "ideamemo-home-pick";

interface PickResult {
  idea: Idea;
  connections: Connection[];
}

function daysSince(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

export function pickHomeIdea(ideas: Idea[], connections: Connection[]): PickResult | null {
  if (ideas.length === 0) return null;

  const connCountMap = new Map<string, number>();
  connections.forEach((c) => {
    connCountMap.set(c.idea_from_id, (connCountMap.get(c.idea_from_id) || 0) + 1);
    if (c.idea_to_id) {
      connCountMap.set(c.idea_to_id, (connCountMap.get(c.idea_to_id) || 0) + 1);
    }
  });

  const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
  if (cached) {
    const cachedId = cached;
    const found = ideas.find((i) => i.id === cachedId);
    if (found) {
      const relatedConns = connections.filter(
        (c) => c.idea_from_id === found.id || c.idea_to_id === found.id
      );
      return { idea: found, connections: relatedConns };
    }
  }

  const weights = ideas.map((idea) => {
    const connCount = connCountMap.get(idea.id) || 0;
    const days = daysSince(idea.created_at);
    let weight = 1;
    weight += connCount * 2;
    if (days >= 3) weight += 3;
    weight += Math.random() * 2;
    return weight;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  let picked = ideas[ideas.length - 1];
  for (let i = 0; i < ideas.length; i++) {
    rand -= weights[i];
    if (rand <= 0) {
      picked = ideas[i];
      break;
    }
  }

  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, picked.id);
  }

  const relatedConns = connections.filter(
    (c) => c.idea_from_id === picked.id || c.idea_to_id === picked.id
  );

  return { idea: picked, connections: relatedConns };
}
