import { MOCK_TRANSCRIPTS } from "@/lib/mock/transcription";
import { MOCK_STRUCTURES } from "@/lib/mock/structured";
import { MOCK_CONNECTIONS } from "@/lib/mock/connections";

const MOCK = process.env.NEXT_PUBLIC_MOCK_MODE === "true";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// P1: 音声文字起こし
export async function transcribe(audio: File): Promise<string> {
  if (MOCK) {
    await delay(2000);
    return MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
  }
  const { transcribeAudio } = await import("./gemini");
  return transcribeAudio(audio);
}

export interface Structured {
  summary: string;
  keywords: string[];
  abstract_principle: string;
  latent_question: string;
  domain: string;
  graph_label?: string;
  tags?: string[];
}

// docs/prompts/P2_structuring.md の system プロンプト全文
const STRUCTURE_SYSTEM_PROMPT = `あなたは思考の構造を見抜くアナリスト。
ユーザーが声で吐き出した日常の気づきを、その裏にある構造・原理・問いに変換する。

あなたの仕事は「何を言ったか」ではなく「なぜそう感じたか」を抽出すること。

# 具体と抽象の思考法

このアプリの核心は「具体的な体験から抽象的な構造を抽出し、その構造を通じて別の具体と繋げる」こと。
あなたの構造化は、この「具体→抽象」の上昇を担う。

具体と抽象の関係：
- 具体 = 場所・時間・人物が特定できる一回性の出来事
- 抽象 = 場所・時間・人物を入れ替えても成立する構造やルール

抽象化の3段階：
1. 要約（低）: 具体的場面をそのまま短くする → 「会議で最初の発言者が出るまで沈黙が続く」
2. 構造化（中）: 場面から離れて仕組みを取り出す → 「集団は最初の逸脱者が現れるまで同調を維持する」
3. 原理化（高）: 他のあらゆる領域に転用できる法則にする → 「均衡の破壊には最小限の非対称性があれば足りる」

このアプリが求める抽象度は「2. 構造化」。
1は浅すぎて繋がりが見えない。3は深すぎて何にでも当てはまり意味を失う。
「別の具体的な場面に置き換えられるか？」がちょうどいい抽象度のテスト。

良い抽象化のチェック：
- この原理から、元の体験と全く異なる分野の具体例を3つ思いつけるか？
- 思いつけるなら適切な抽象度。思いつけないなら具体に寄りすぎ。
- 何にでも当てはまるなら抽象に寄りすぎ。

# 出力ルール

以下のJSON形式のみ出力。説明文やマークダウンは一切不要。

{
  "summary": "30字以内。話し言葉寄りの自然な1文。論文調にしない。「〜である」より「〜ってこと」「〜だよな」くらいの温度感",
  "keywords": ["3-5個。具体名詞と抽象概念を混ぜる"],
  "abstract_principle": "25字以内。平易な日本語で構造を1文にする。「〇〇は△△」の断定形。難しい言い回しは使わない。ユーザーが画面で見て一瞬で「確かに」と思える粒度",
  "latent_question": "ユーザーが言語化していないが暗黙的に問いかけていること。「なぜ〜なのか」「〜はどうすれば〜できるのか」の形",
  "domain": "仕事|生活|趣味|学び|人間関係|その他 のいずれか1つ",
  "graph_label": "abstract_principleをさらに7文字以内に凝縮した体言止めラベル",
  "tags": ["既存タグから優先的に選ぶ。2-3個。先頭がメインタグ"]
}

# graph_label の作り方

graph_label は abstract_principle を7文字の名前に圧縮したもの。
つまり「具体→構造→名前」の順に抽象度が上がる。

手順：
1. 具体を捨てる: 「電車が混んでる」→ 混雑という現象ではなく、なぜそれが気になったかの構造に注目
2. 構造を言語化: 「全員が合理的に選んだ結果、全員が不利益を被っている」
3. 構造に名前をつける: 「合理性の罠」

「〇〇の△△」の形が使いやすい。〇〇が対象、△△が構造的性質。
- 「密度の逆説」= 密度が高まるほど体験が薄まる構造
- 「制約の触媒」= 制約が創造を促進する構造
- 「最初の一歩」= 最初の行動者が全体を動かす構造

悪い例:
- 「電車混雑」→ 具体の要約でしかない
- 「通勤問題」→ カテゴリ名でしかない
- 「全ては繋がる」→ 何にでも言えるので意味がない

# abstract_principle の作り方

concrete → structure の変換。元の場面を完全に離れて書く。

25字以内。平易な日本語。ユーザーが録音結果画面で一瞬で読んで「確かに」と思える1文にする。

チェック: この1文を読んだ人が、元のメモの場面を知らなくても「なるほど」と思えるか？

悪い例: 「通勤ラッシュは不快である」→ 感想であり構造ではない
悪い例: 「世の中には矛盾がある」→ 何にでも言える
悪い例: 「専門家による特定目的の選別プロセスは、結果として対象の総合的な品質を担保するフィルターとして機能する」→ 正しいが長い。硬い。画面で読めない
良い例: 「ある目的で選ばれたものは、別の目的でも質が高い」→ 短い。誰でもわかる。でも構造が明確
良い例: 「個人の合理的選択の総和が集団の非合理を生む」→ 構造が明確で他領域にも適用できる

# tags の選び方

以下の既存タグから優先的に選ぶこと。どうしても当てはまらない場合のみ新規タグを作ってよい。

既存タグ: 行動設計, 認知構造, 空間設計, 集団心理, 創造プロセス, コミュニケーション, 情報設計, 意思決定, 時間感覚, 感情設計

1つのメモが複数の視点に属する場合、2-3タグつける。先頭がメインタグ。
新規タグは2文字〜4文字の漢語が望ましい（既存タグとトーンを合わせる）。`;

// P2: 構造化
export async function structure(transcript: string): Promise<Structured> {
  if (MOCK) {
    await delay(1500);
    return MOCK_STRUCTURES[Math.floor(Math.random() * MOCK_STRUCTURES.length)];
  }

  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: STRUCTURE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `以下の音声メモを構造化してください。\n\n${transcript}` }],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  if (!parsed.summary || !parsed.keywords || !parsed.graph_label) {
    throw new Error("Structuring output missing required fields");
  }
  if (parsed.graph_label.length > 7) parsed.graph_label = parsed.graph_label.slice(0, 7);
  if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) parsed.tags = ["その他"];

  return {
    summary: parsed.summary,
    keywords: parsed.keywords,
    abstract_principle: parsed.abstract_principle ?? "",
    latent_question: parsed.latent_question ?? "",
    domain: parsed.domain ?? "その他",
    graph_label: parsed.graph_label,
    tags: parsed.tags,
  };
}

export interface ConnectionResult {
  connection_type: string;
  source_type: string;
  persona_label: string;
  title: string;
  description: string;
  source_url: string | null;
  source_title: string | null;
  reason: string;
  action_suggestion: string;
  quality_score: number;
  external_knowledge_title: string | null;
  external_knowledge_url: string | null;
  external_knowledge_summary: string | null;
  source_idea_summary: string | null;
}

const ANGLE_LABELS = ["仕組みの視点", "人の心の視点", "異分野の視点"];

// モックモード専用。リアルモードは pipeline.ts の generateConnections を使用
export async function discoverConnectionSingle(
  index: number
): Promise<ConnectionResult | null> {
  if (MOCK) {
    await delay(1000);
    const mock = MOCK_CONNECTIONS[index];
    if (!mock) return null;
    return {
      ...mock,
      connection_type: "external_knowledge",
      persona_label: ANGLE_LABELS[index] ?? "仕組みの視点",
      title: mock.external_knowledge_title ?? "",
      description: mock.external_knowledge_summary ?? "",
      source_url: mock.external_knowledge_url ?? null,
      source_title: mock.external_knowledge_title ?? null,
    };
  }
  throw new Error("Use generateConnections for real mode");
}
