import type { Idea, Connection } from "@/lib/types";
import { MOCK_USER_SETTINGS } from "./data";
import { SEED_IDEAS, SEED_CONNECTIONS } from "./seed";

type UserSettings = typeof MOCK_USER_SETTINGS;

export interface ChatSession {
  id: string;
  user_id: string;
  idea_id: string | null;
  connection_id: string | null;
  context_type: "connection" | "combination";
  context_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

let ideas: Idea[] = [...SEED_IDEAS];
let connections: Connection[] = [...SEED_CONNECTIONS];
let chatSessions: ChatSession[] = [];
let chatMessages: ChatMessage[] = [];
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
    listByUser(_userId: string): Idea[] {
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
    delete(id: string): void {
      ideas = ideas.filter((i) => i.id !== id);
    },
  },
  connections: {
    insert(conn: Connection): Connection {
      connections.push(conn);
      return conn;
    },
    list(): Connection[] {
      return [...connections];
    },
    listByIdea(ideaId: string): Connection[] {
      return connections.filter(
        (c) => c.idea_from_id === ideaId || c.idea_to_id === ideaId
      );
    },
    listByUser(_userId: string): Connection[] {
      return [...connections];
    },
    get(id: string): Connection | undefined {
      return connections.find((c) => c.id === id);
    },
    updateFeedback(id: string, feedback: "positive" | "negative"): void {
      const conn = connections.find((c) => c.id === id);
      if (conn) {
        conn.feedback = feedback;
        conn.feedback_at = new Date().toISOString();
      }
    },
    toggleBookmark(id: string): boolean {
      const conn = connections.find((c) => c.id === id);
      if (conn) {
        conn.bookmarked = !conn.bookmarked;
        return conn.bookmarked;
      }
      return false;
    },
    listBookmarked(): Connection[] {
      return connections.filter((c) => c.bookmarked === true);
    },
    deleteByIdea(ideaId: string): void {
      connections = connections.filter(
        (c) => c.idea_from_id !== ideaId && c.idea_to_id !== ideaId
      );
    },
    getFeedbackSummary(_userId: string): { positive: string[]; negative: string[] } {
      const positive = connections
        .filter((c) => c.feedback === "positive")
        .slice(-5)
        .map((c) => c.reason);
      const negative = connections
        .filter((c) => c.feedback === "negative")
        .slice(-3)
        .map((c) => c.reason);
      return { positive, negative };
    },
  },
  chatSessions: {
    list(): ChatSession[] {
      return [...chatSessions].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    },
    get(id: string): ChatSession | null {
      return chatSessions.find((s) => s.id === id) ?? null;
    },
    create(session: ChatSession): void {
      chatSessions.push(session);
    },
    listByIdea(ideaId: string): ChatSession[] {
      return chatSessions
        .filter((s) => s.idea_id === ideaId)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    },
    findByConnection(connectionId: string): ChatSession | null {
      return chatSessions.find((s) => s.connection_id === connectionId) ?? null;
    },
    updateTimestamp(id: string): void {
      const session = chatSessions.find((s) => s.id === id);
      if (session) session.updated_at = new Date().toISOString();
    },
    deleteByIdea(ideaId: string): void {
      const sessionIds = chatSessions.filter((s) => s.idea_id === ideaId).map((s) => s.id);
      chatMessages = chatMessages.filter((m) => !sessionIds.includes(m.session_id));
      chatSessions = chatSessions.filter((s) => s.idea_id !== ideaId);
    },
  },
  chatMessages: {
    listBySession(sessionId: string): ChatMessage[] {
      return chatMessages
        .filter((m) => m.session_id === sessionId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
    insert(message: ChatMessage): void {
      chatMessages.push(message);
    },
  },
  reset() {
    ideas = [...SEED_IDEAS];
    connections = [...SEED_CONNECTIONS];
    chatSessions = [];
    chatMessages = [];
  },
};
