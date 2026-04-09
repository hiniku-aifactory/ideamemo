import { searchBrave } from "@/lib/search/brave";
import { PERSONA_MAP, type PersonaId } from "@/lib/personas";
import type { ConnectionResult } from "./index";

interface PipelineInput {
  summary: string;
  keywords: string[];
  abstract_principle: string;
  transcript: string;
  personas: PersonaId[];
  userProfile?: Record<string, unknown>;
  feedbackHistory?: { positive: string[]; negative: string[] };
}

export async function generateConnection(
  input: PipelineInput,
  personaId: PersonaId
): Promise<ConnectionResult> {
  const persona = PERSONA_MAP[personaId];

  // 動的インポートでAnthropicクライアントを取得（ビルド時にAPI keyがなくてもエラーにならない）
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // 1. 検索クエリ生成
  const queryResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    system: "You generate web search queries in English. Respond with ONLY the query, no explanation.",
    messages: [
      {
        role: "user",
        content: `Generate one English web search query (3-8 words) to find external knowledge that connects to this memo from the angle: ${persona.searchAngle}

Memo summary: ${input.summary}
Keywords: ${input.keywords.join(", ")}
Core principle: ${input.abstract_principle}

The query should find specific examples, case studies, or research — not generic information.`,
      },
    ],
  });

  const searchQuery = (queryResponse.content[0] as { type: string; text: string }).text.trim();

  // 2. Brave Search
  const searchResults = await searchBrave(searchQuery, 3);

  // 3. 接続合成
  const fbSection = input.feedbackHistory
    ? `
# フィードバック傾向
- 好む接続: ${input.feedbackHistory.positive.slice(0, 3).join("; ") || "まだなし"}
- 嫌う接続: ${input.feedbackHistory.negative.slice(0, 3).join("; ") || "まだなし"}`
    : "";

  const profileSection = input.userProfile && Object.keys(input.userProfile).length > 0
    ? `\n# ユーザープロファイル\n${JSON.stringify(input.userProfile, null, 2)}`
    : "";

  const synthesisResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: `あなたはリサーチャー。ユーザーの気づきに関連する外部知識を見つけて、事実を端的に紐づける。

${persona.promptInstruction}
${profileSection}
${fbSection}

# 出力ルール
- 見出し: その外部知識を一言で表す名詞句（10-20字）
- 説明: 事実のみ。2-3文。数字・社名・年号を含める
- 命令しない。提案しない。事実を述べる
- 「〜かもしれません」「〜してみてください」禁止
- JSON形式のみ出力`,
    messages: [
      {
        role: "user",
        content: `# メモ
要点: ${input.summary}
キーワード: ${input.keywords.join(", ")}
本質: ${input.abstract_principle}
原文: ${input.transcript}

# 検索結果
${searchResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`).join("\n\n")}

以下のJSON形式で知識を1つ紐づけ:
{
  "title": "見出し（名詞句、10-20字）",
  "description": "事実の説明（2-3文）",
  "source_url": "URL",
  "source_title": "引用元タイトル",
  "quality_score": 0.0-1.0
}`,
      },
    ],
  });

  const text = (synthesisResponse.content[0] as { type: string; text: string }).text.trim();
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  return {
    connection_type: "external_knowledge",
    source_type: "external",
    persona_label: persona.label,
    title: parsed.title ?? "",
    description: parsed.description ?? "",
    source_url: parsed.source_url ?? null,
    source_title: parsed.source_title ?? null,
    reason: parsed.description ?? "",
    action_suggestion: "",
    quality_score: parsed.quality_score ?? 0.7,
    external_knowledge_title: parsed.title ?? null,
    external_knowledge_url: parsed.source_url ?? null,
    external_knowledge_summary: parsed.description ?? null,
    source_idea_summary: "",
  };
}
