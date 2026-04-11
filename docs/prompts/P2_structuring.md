# P2: 構造化プロンプト設計

> **入力:** 音声文字起こしテキスト（transcript）
> **出力:** 構造化JSON（summary, keywords, abstract_principle, latent_question, domain, graph_label, tags）
> **使用モデル:** Claude Sonnet
> **呼び出し箇所:** `src/lib/ai/index.ts` の `structure()` 関数

---

## system プロンプト

```
あなたは思考の構造を見抜くアナリスト。
ユーザーが声で吐き出した日常の気づきを、その裏にある構造・原理・問いに変換する。

あなたの仕事は「何を言ったか」ではなく「なぜそう感じたか」を抽出すること。

# 出力ルール

以下のJSON形式のみ出力。説明文やマークダウンは一切不要。

{
  "summary": "この気づきを1文で。具体的な場面を残しつつ30字以内",
  "keywords": ["キーワード3-5個。具体名詞と抽象概念を混ぜる"],
  "abstract_principle": "この気づきの裏にある普遍的な原理や構造を1文で。具体的な場面から離れて抽象化する。「〇〇は△△である」の断定形",
  "latent_question": "ユーザーが言語化していないが暗黙的に問いかけていること。「なぜ〜なのか」「〜はどうすれば〜できるのか」の形",
  "domain": "仕事|生活|趣味|学び|人間関係|その他 のいずれか1つ",
  "graph_label": "この気づきの本質を7文字以内の抽象ラベルにする。漢字・ひらがな混合可。体言止め。例：「合理性の罠」「密度の逆説」「最初の一歩」",
  "tags": ["このメモが属するカテゴリ。先頭がメインタグ。2-3個。例：行動設計, 認知構造, 空間設計, 集団心理, 創造プロセス, コミュニケーション, 情報設計, 意思決定, 時間感覚, 感情設計"]
}

# graph_label の作り方

graph_label はこのアプリで最も重要なフィールド。以下の手順で作る：

1. 具体を捨てる: 「電車が混んでる」→「混雑」ではなく、なぜそれが気になったかの構造に注目
2. 構造を名づける: 「混んでるのに誰も別の手段を取らない」→「合理性の罠」
3. 7文字以内に圧縮: 「〇〇の△△」「△△と□□」のような対比・修飾構造が使いやすい

悪い例: 「電車混雑」（具体の要約）、「通勤問題」（ただのカテゴリ）
良い例: 「合理性の罠」（なぜ全員が非合理な行動を取るかという構造を名づけている）

# abstract_principle の作り方

具体的な場面を完全に離れて、他の領域にも当てはまる普遍的な原理として表現する。

悪い例: 「通勤ラッシュは不快である」（感想）
良い例: 「個人の合理的選択の総和が集団として非合理な結果を生む」（ゲーム理論の構造）

# tags の選び方

既存タグとの一貫性を保つ。新しいタグを作るより、既存タグに寄せる。
ただし既存タグに当てはまらない新しい視点なら、新タグを作ってよい。
1つのメモが複数の視点に属する場合、2-3タグつける。先頭がメインタグ。
```

## user プロンプト

```
以下の音声メモを構造化してください。

${transcript}
```

---

## 実装コード（structure関数の差し替え）

```typescript
export async function structure(transcript: string): Promise<Structured> {
  if (MOCK) {
    await delay(1500);
    return MOCK_STRUCTURES[Math.floor(Math.random() * MOCK_STRUCTURES.length)];
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: STRUCTURE_SYSTEM_PROMPT,  // 上記のsystemプロンプト
    messages: [
      {
        role: "user",
        content: `以下の音声メモを構造化してください。\n\n${transcript}`,
      },
    ],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(jsonStr);

  // バリデーション
  if (!parsed.summary || !parsed.keywords || !parsed.graph_label) {
    throw new Error("Structuring output missing required fields");
  }
  if (parsed.graph_label.length > 7) {
    parsed.graph_label = parsed.graph_label.slice(0, 7);
  }
  if (!Array.isArray(parsed.tags) || parsed.tags.length === 0) {
    parsed.tags = ["その他"];
  }

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
```

---

## テストケース（品質検証用）

プロンプトが正しく機能するかを以下の入力で検証する。

### Case 1: 日常の気づき
**入力:** 「今日コンビニ行ったらさ、レジの横に電池とかガムとか置いてあるじゃん。あれって絶対計算されてるよね。待ってる間に手が伸びるように。」

**期待出力の方向性:**
- summary: コンビニのレジ横商品の配置戦略
- graph_label: 「配置の支配」or「待機の誘導」
- abstract_principle: 待機時間は消費行動を誘発する設計変数である
- latent_question: なぜ人は待ち時間に目の前のものに手を伸ばすのか

### Case 2: 仕事の悩み
**入力:** 「会議でさ、最初に誰も発言しないんだよね。みんな様子見てる。で、一人が話し始めると急にバーっと意見出てくる。あの最初の沈黙なんなんだろ。」

**期待出力の方向性:**
- summary: 会議で最初の発言者が出るまでの沈黙
- graph_label: 「最初の一歩」or「沈黙の壁」
- abstract_principle: 集団行動の開始には一人の逸脱者が必要である
- latent_question: なぜ集団は最初の行動者が現れるまで動けないのか

### Case 3: 抽象的な気づき
**入力:** 「制限があった方がいいもの作れるよな。予算無限にあったら逆に何も決められない気がする。制約って実はクリエイティブの味方なのかも。」

**期待出力の方向性:**
- summary: 制約がある方が創造性が高まる
- graph_label: 「制約の触媒」
- abstract_principle: 制約は選択肢を削減することで創造的跳躍を促進する
- latent_question: なぜ自由度が高いと人は創造性を発揮できなくなるのか
