import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GroundingResult {
  title: string;
  url: string;
  description: string;
}

function getClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

// P1: 音声文字起こし
export async function transcribeAudio(audioFile: File): Promise<string> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

  const buffer = await audioFile.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = audioFile.type || "audio/webm";

  const result = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    {
      text: "この日本語音声を文字起こししてください。「えーと」「あの」等のフィラーは除去。句読点を適切に入れる。文字起こしのみ出力。",
    },
  ]);

  return result.response.text().trim();
}

// P3/P4: Grounding検索（Scout方式 — Geminiテキスト + ソースURLを返す）
// Gemini SDKのtools型定義・groundingMetadataは不安定なためas anyで対応（2026年現在）
export async function groundingSearchWithText(query: string): Promise<{
  text: string;
  sources: GroundingResult[];
}> {
  const client = getClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = client.getGenerativeModel({ model: "gemini-2.5-flash", tools: [{ googleSearch: {} } as any] });

  const result = await model.generateContent(query);
  const response = result.response;
  const text = response.text().trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata = (response.candidates?.[0] as any)?.groundingMetadata;
  const sources: GroundingResult[] = (metadata?.groundingChunks ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((chunk: any) => chunk.web)
    .slice(0, 3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((chunk: any) => ({
      title: (chunk.web.title as string) ?? "",
      url: (chunk.web.uri as string) ?? "",
      description: "",
    }));

  return { text, sources };
}
