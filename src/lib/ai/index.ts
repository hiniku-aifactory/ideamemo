import { MOCK_TRANSCRIPTS } from "@/lib/mock/transcription";
import { MOCK_STRUCTURES } from "@/lib/mock/structured";
import { MOCK_CONNECTIONS } from "@/lib/mock/connections";

const MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function transcribe(_audio: File): Promise<string> {
  if (MOCK) {
    await delay(2000);
    return MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
  }
  // TODO: Gemini 2.0 Flash real implementation
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
  // TODO: Claude Sonnet real implementation
  throw new Error("Real structuring not implemented yet");
}

export interface ConnectionResult {
  connection_type: string;
  source_type: string;
  reason: string;
  action_suggestion: string;
  quality_score: number;
  external_knowledge_title: string | null;
  external_knowledge_url: string | null;
}

export async function discoverConnection(): Promise<ConnectionResult | null> {
  if (MOCK) {
    await delay(3000);
    return MOCK_CONNECTIONS[Math.floor(Math.random() * MOCK_CONNECTIONS.length)];
  }
  // TODO: Claude Opus + Brave Search real implementation
  throw new Error("Real connection discovery not implemented yet");
}
