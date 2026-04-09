export type Domain = "仕事" | "生活" | "趣味" | "学び" | "人間関係" | "その他";

export type ConnectionType =
  | "external_knowledge"
  | "combination";

export interface Idea {
  id: string;
  user_id: string;
  transcript: string;
  summary: string;
  keywords: string[];
  abstract_principle: string;
  domain: Domain;
  audio_url: string | null;
  folder_id: string | null;
  folder_name: string | null;
  created_at: string;
}

export interface Connection {
  id: string;
  idea_from_id: string;
  idea_to_id: string | null;
  connection_type: ConnectionType;
  source: "ai" | "manual" | "combination";
  persona_label: string | null;
  reason: string;
  action_suggestion: string;
  quality_score: number | null;
  external_knowledge_title: string | null;
  external_knowledge_url: string | null;
  external_knowledge_summary: string | null;
  source_idea_summary: string | null;
  user_note: string | null;
  feedback: "positive" | "negative" | null;
  feedback_at: string | null;
  created_at: string;
}

export interface SSEEvent {
  event: "transcription" | "structured" | "connection" | "done" | "error";
  data: Record<string, unknown>;
}
