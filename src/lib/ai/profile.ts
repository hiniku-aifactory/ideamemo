import { mockDb } from "@/lib/mock/db";

const MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

const PROFILE_THRESHOLDS = [5, 10, 20];

export async function maybeUpdateProfile(userId: string): Promise<void> {
  const ideas = mockDb.ideas.listByUser(userId);
  const count = ideas.length;

  if (!PROFILE_THRESHOLDS.includes(count)) return;

  console.log(`[Profile] Updating profile for user ${userId} at ${count} memos`);

  if (MOCK) {
    const mockProfile = {
      interests: ["プロダクト開発", "UX設計", "行動経済学"],
      current_challenges: ["意思決定の速度", "ユーザーFBの活用"],
      thinking_style: "構造で理解したがる。「なぜ」を掘る傾向",
      aspiration: "自分のプロダクトをPMFさせたい",
      connection_preference: "具体的な企業事例と数字がある接続を好む",
    };
    mockDb.userSettings.update(userId, { ai_profile: mockProfile });
    return;
  }

  // リアルモード: Claude Sonnet でプロファイル生成
  if (!process.env.ANTHROPIC_API_KEY) return;
  try {
    const recentIdeas = ideas.slice(0, count);
    const ideasText = recentIdeas.map((idea, i) =>
      `${i + 1}. 要約: ${idea.summary}\n   本質: ${idea.abstract_principle}\n   キーワード: ${idea.keywords.join(", ")}\n   ドメイン: ${idea.domain}`
    ).join("\n\n");

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: `ユーザーの${count}件のメモを分析し、思考傾向をJSON形式で出力せよ。出力はJSONのみ。
{
  "interests": ["関心領域を2-3個"],
  "current_challenges": ["現在の課題を1-2個"],
  "thinking_style": "思考スタイルを1文で",
  "aspiration": "目指していることを1文で",
  "connection_preference": "どんな接続カードを好むか1文で"
}`,
      messages: [{ role: "user", content: `メモ一覧:\n\n${ideasText}` }],
    });
    const text = (res.content[0] as { type: string; text: string }).text.trim();
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const profile = JSON.parse(cleaned.slice(start, end + 1));
    mockDb.userSettings.update(userId, { ai_profile: profile });
    console.log(`[Profile] Generated profile for user ${userId}`);
  } catch (e) {
    console.error("[Profile] Generation failed:", e);
  }
}
