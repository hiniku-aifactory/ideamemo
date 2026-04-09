import type { Idea, Connection } from "@/lib/types";
import { MOCK_USER_SETTINGS } from "./data";

type UserSettings = typeof MOCK_USER_SETTINGS;

let ideas: Idea[] = [];
let connections: Connection[] = [];
const userSettingsMap = new Map<string, UserSettings>([
  [MOCK_USER_SETTINGS.user_id, { ...MOCK_USER_SETTINGS }],
]);

export const mockDb = {
  userSettings: {
    get(userId: string): UserSettings | undefined {
      return userSettingsMap.get(userId);
    },
    update(userId: string, partial: Partial<UserSettings>): UserSettings | undefined {
      const existing = userSettingsMap.get(userId);
      if (!existing) return undefined;
      const updated = { ...existing, ...partial };
      userSettingsMap.set(userId, updated);
      return updated;
    },
  },
  ideas: {
    insert(idea: Idea): Idea {
      ideas.push(idea);
      return idea;
    },
    list(): Idea[] {
      return [...ideas].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    get(id: string): Idea | undefined {
      return ideas.find((i) => i.id === id);
    },
    count(): number {
      return ideas.length;
    },
  },
  connections: {
    insert(conn: Connection): Connection {
      connections.push(conn);
      return conn;
    },
    listByIdea(ideaId: string): Connection[] {
      return connections.filter(
        (c) => c.idea_from_id === ideaId || c.idea_to_id === ideaId
      );
    },
  },
  reset() {
    ideas = [];
    connections = [];
  },
};
