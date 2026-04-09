import { MOCK_TRANSCRIPTS } from "@/lib/mock/transcription";
import { MOCK_STRUCTURES } from "@/lib/mock/structured";
import { MOCK_CONNECTIONS } from "@/lib/mock/connections";
import type { PersonaId } from "@/lib/personas";

const MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function transcribe(_audio: File): Promise<string> {
  if (MOCK) {
    await delay(2000);
    return MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
  }
  // TODO: Gemini 2.0 Flash
  throw new Error("Real transcription not implemented yet");
}

export interface Structured {
  summary: string;
  keywords: string[];
  abstract_principle: string;
  domain: string;
}

export async function structure(_transcript: string): Promise<Structured> {
  if (MOCK) {
    await delay(1500);
    return MOCK_STRUCTURES[Math.floor(Math.random() * MOCK_STRUCTURES.length)];
  }
  // TODO: Claude Sonnet
  throw new Error("Real structuring not implemented yet");
}

export interface ConnectionResult {
  connection_type: string;
  source_type: string;
  persona_label: string;
  reason: string;
  action_suggestion: string;
  quality_score: number;
  external_knowledge_title: string | null;
  external_knowledge_url: string | null;
  external_knowledge_summary: string | null;
  source_idea_summary: string | null;
}

const PERSONA_LABELS = ["作っている人の視点", "伸ばしている人の視点", "深めている人の視点"];

export async function discoverConnectionSingle(
  index: number,
  _personas?: PersonaId[]
): Promise<ConnectionResult | null> {
  if (MOCK) {
    await delay(1000);
    const mock = MOCK_CONNECTIONS[index];
    if (!mock) return null;
    return {
      ...mock,
      connection_type: "external_knowledge",
      persona_label: PERSONA_LABELS[index] ?? "作っている人の視点",
    };
  }
  // リアルモードは pipeline.ts の generateConnection を使用
  throw new Error("Use generateConnection for real mode");
}
