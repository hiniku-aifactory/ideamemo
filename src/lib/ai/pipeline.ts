import { searchBrave } from "@/lib/search/brave";
import { PERSONA_MAP, type PersonaId } from "@/lib/personas";
import type { ConnectionResult } from "./index";

export const SEARCH_ANGLES = {
  business_model: {
    label: "仕組みの視点",
    searchBias: "business model service company startup",
    promptGuide: `同じ構造・同じ課題を解決しているビジネス、サービス、制度、広告を見つけろ。
「こんなビジネスがある」「こんな広告がある」「こんなサービスが流行ってる」と伝える。
具体的な社名・サービス名・数字（売上、ユーザー数、年）を必ず含める。
ユーザーが「え、そんなのあるんだ」と思うものを優先する。`,
  },
  psychology: {
    label: "人の心の視点",
    searchBias: "psychology behavioral economics cognitive bias research",
    promptGuide: `この気づきの裏にある人間心理、認知バイアス、行動経済学の知見を見つけろ。
「人はこう動く」「こういう実験結果がある」と伝える。
実験名、研究者名、年、具体的な数値を必ず含める。
ユーザーが「だからそうなるのか」と腑に落ちるものを優先する。`,
  },
  cross_domain: {
    label: "異分野の視点",
    searchBias: "analogy pattern different field unexpected connection",
    promptGuide: `全く別の分野で同じパターン・構造が存在する事例を見つけろ。
生物学、物理学、音楽、建築、スポーツ、料理、軍事 — どこでもいい。
「意外にも○○の世界でも同じことが起きている」と伝える。
ユーザーが「面白い！そんなところで！」と感じるものを優先する。`,
  },
} as const;

export type SearchAngle = keyof typeof SEARCH_ANGLES;

interface PipelineInput {
  summary: string;
  keywords: string[];
  abstract_principle: string;
  transcript: string;
  searchAngle: SearchAngle;
  personaId: PersonaId;
  userProfile?: Record<string, unknown>;
  feedbackHistory?: { positive: string[]; negative: string[] };
}

export async function generateConnection(
  input: PipelineInput
): Promise<ConnectionResult> {
  const angle = SEARCH_ANGLES[input.searchAngle];
  const persona = PERSONA_MAP[input.personaId];

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
        content: `Generate one English web search query (3-8 words) to find surprising, specific external knowledge.

Memo summary: ${input.summary}
Keywords: ${input.keywords.join(", ")}
Core principle: ${input.abstract_principle}

Search angle: ${angle.searchBias}
User interest bias: ${persona.searchAngle}

The query should find SPECIFIC examples (company names, study names, product names) — not generic concepts.`,
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
    system: `あなたは知的好奇心を刺激するリサーチャー。
ユーザーの日常の気づきに対して「え、そうなの？」「面白い！」と思える外部知識を紐づける。

# あなたの角度
${angle.promptGuide}

# ユーザーの関心傾向
${persona.promptInstruction}
${profileSection}
${fbSection}

# 出力ルール
- 見出し: その外部知識を一言で表す（10-25字）。固有名詞を含めること
- 説明: 2-3文。具体的な数字・社名・年号・実験名を含める
- 最後の1文で「ユーザーの気づきとどう繋がるか」を1行で示す（ただし命令しない）
- 「〜してみてください」「〜かもしれません」禁止
- 断定調で書く。事実は事実として述べる
- JSON形式のみ出力`,
    messages: [
      {
        role: "user",
        content: `# ユーザーの気づき
要点: ${input.summary}
キーワード: ${input.keywords.join(", ")}
本質: ${input.abstract_principle}
原文: ${input.transcript}

# 検索結果
${searchResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`).join("\n\n")}

以下のJSON形式で知識を1つ紐づけ:
{
  "title": "見出し（固有名詞を含む、10-25字）",
  "description": "事実の説明（2-3文、数字・固有名詞必須）+ 気づきとの接続1文",
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
    persona_label: angle.label,
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
