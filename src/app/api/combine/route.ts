import { NextRequest, NextResponse } from "next/server";
import { mockDb } from "@/lib/mock/db";
import { MOCK_MODE } from "@/lib/mock/data";
import { MOCK_COMBINE_RESULTS } from "@/lib/mock/combine";
import type { Connection, Idea } from "@/lib/types";

// docs/prompts/P5_combine.md から引用
const COMBINE_SYSTEM_PROMPT = `あなたは2つのアイデアメモの掛け合わせから新しい気づきを生み出す。

# やること
1. 2つのメモのabstract_principleを読む
2. 両方の構造が同時に成立する場面を見つける
3. その場面から見える新しい気づきを1つ言語化する
4. その気づきを試す最小の行動を1つ提案する

# 掛け合わせの方法

## ステップ1: 構造の抽出
2つのメモそれぞれの「構造」を1文で捉え直す。
abstract_principleをそのまま使わず、自分の言葉で再解釈する。

## ステップ2: 衝突点を見つける
以下の5つの型から最もフィットするものを選ぶ:

型A「同じことを言ってる」
→ 異なる文脈で同じ構造が現れている。なぜ繰り返すのか？

型B「正反対のことを言ってる」
→ 矛盾しているように見えて、実は条件が違うだけ。境界はどこか？

型C「AがBの原因になってる」
→ 一方がもう一方を引き起こす構造がある。連鎖の先には何がある？

型D「AがBを解決する」
→ 一方の構造が、もう一方の問題の解法になっている

型E「AとBを組み合わせると第三の何かが生まれる」
→ どちらか単体では見えない視点が、重ねると浮かび上がる

## ステップ2.5: 片方テスト
見つけた衝突点について以下を確認:
- メモAだけでこの気づきに辿り着けるか？ → YESなら掛け合わせになっていない。やり直し
- メモBだけでこの気づきに辿り着けるか？ → YESなら掛け合わせになっていない。やり直し
両方NOの場合のみステップ3に進む

## ステップ3: 気づきの言語化
衝突点から見えた気づきを2-3文で書く。

## ステップ4: TRY THIS
気づきを試す最小の行動を1文で提案する。
「明日できること」レベルの具体性。壮大な計画は禁止。

# 口調
- 知的な友達が「これ面白くない？」って言ってる感じ
- 断定調。「〜かもしれません」禁止
- 禁止ワード: 「シナジー」「融合」「統合」「パラダイム」「原理」「メカニズム」「示唆する」

# 品質チェック（出力前に自問）
1. 2つのメモを読んだだけでは思いつかない気づきか？ → 思いつくなら掛け合わせの意味がない
2. 友達にLINEで送れるか？ → 送れないなら硬すぎる
3. TRY THISは明日やれるか？ → やれないなら壮大すぎる
4. 片方のメモだけで成立する気づきになっていないか？ → なっていたら掛け合わせじゃなくて深掘りになってる`;

function buildCombineUserPrompt(ideaA: Idea, ideaB: Idea): string {
  return `# メモA
要約: ${ideaA.summary}
本質: ${ideaA.abstract_principle}
問い: ${ideaA.latent_question}
キーワード: ${ideaA.keywords.join(", ")}

# メモB
要約: ${ideaB.summary}
本質: ${ideaB.abstract_principle}
問い: ${ideaB.latent_question}
キーワード: ${ideaB.keywords.join(", ")}

以下のJSON形式で出力:
{
  "collision_type": "same|opposite|cause|solve|emerge",
  "insight": "掛け合わせから見えた気づき。2-3文。具体的に",
  "try_this": "この気づきを試す最小の行動。1文。明日できるレベル",
  "graph_label": "この気づきを7文字以内の名前にする。「〇〇の△△」の形",
  "connection_reason": "なぜこの2つが繋がるのか。1文。ユーザーが納得できる説明"
}`;
}

export async function POST(request: NextRequest) {
  try {
    const { ideaAId, ideaBId } = await request.json();

    if (!ideaAId || !ideaBId) {
      return NextResponse.json({ error: "Both idea IDs required" }, { status: 400 });
    }

    const ideaA = mockDb.ideas.get(ideaAId);
    const ideaB = mockDb.ideas.get(ideaBId);

    if (!ideaA || !ideaB) {
      return NextResponse.json({ error: "Ideas not found" }, { status: 404 });
    }

    let result;
    if (MOCK_MODE) {
      await new Promise((r) => setTimeout(r, 1500));
      result = MOCK_COMBINE_RESULTS[Math.floor(Math.random() * MOCK_COMBINE_RESULTS.length)];
    } else {
      // リアルモード: Claude Sonnet で掛け合わせ生成（P5）
      if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
      }
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: COMBINE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildCombineUserPrompt(ideaA, ideaB) }],
      });

      const text = (response.content[0] as { type: string; text: string }).text.trim();
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(jsonStr);

      result = {
        reason: parsed.connection_reason ?? "",
        action_suggestion: parsed.try_this ?? "",
        quality_score: 0.8,
        insight: parsed.insight,
        try_this: parsed.try_this,
        graph_label: parsed.graph_label,
        collision_type: parsed.collision_type,
      };
    }

    const conn: Connection = {
      id: crypto.randomUUID(),
      idea_from_id: ideaAId,
      idea_to_id: ideaBId,
      connection_type: "combination",
      source: "combination",
      persona_label: null,
      reason: result.reason,
      action_suggestion: result.action_suggestion,
      quality_score: result.quality_score,
      external_knowledge_title: null,
      external_knowledge_url: null,
      external_knowledge_summary: null,
      source_idea_summary: null,
      user_note: null,
      feedback: null,
      feedback_at: null,
      bookmarked: false,
      created_at: new Date().toISOString(),
      collision_type: (result as { collision_type?: string }).collision_type,
      try_this: (result as { try_this?: string }).try_this,
    };

    mockDb.connections.insert(conn);

    return NextResponse.json({
      connection: conn,
      ideaA: { summary: ideaA.summary },
      ideaB: { summary: ideaB.summary },
    });
  } catch (error) {
    console.error("[Combine] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
