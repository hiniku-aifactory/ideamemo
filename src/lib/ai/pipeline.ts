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
    system: `あなたは鋭いリサーチャーです。ユーザーのメモと外部知識を繋げて「確かに！」を作ります。

${persona.promptInstruction}
${profileSection}
${fbSection}

# 出力ルール
- 断定調。「~かもしれません」禁止。「~だ。」で終わる
- 具体的。社名、人名、数字、年号を必ず含める
- JSON形式のみ出力。マークダウンや説明文は一切不要`,
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

以下のJSON形式で接続を1つ生成:
{
  "reason": "つながりの理由（2-3文、断定調）",
  "action_suggestion": "具体的な次のアクション（1文、TRY THIS:は不要）",
  "external_knowledge_title": "引用元のタイトル",
  "external_knowledge_url": "URL",
  "external_knowledge_summary": "外部知識の要約（2-3文）",
  "source_idea_summary": "元メモの要点（1文）",
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
    reason: parsed.reason,
    action_suggestion: parsed.action_suggestion,
    quality_score: parsed.quality_score ?? 0.7,
    external_knowledge_title: parsed.external_knowledge_title,
    external_knowledge_url: parsed.external_knowledge_url,
    external_knowledge_summary: parsed.external_knowledge_summary,
    source_idea_summary: parsed.source_idea_summary,
  };
}
