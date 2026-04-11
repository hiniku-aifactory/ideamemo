# P3: 外部知識接続プロンプト設計

> **入力:** P2構造化済みJSON + ペルソナ + 検索アングル
> **出力:** 外部知識カード（title, description, source_url, source_title）
> **使用モデル:** Claude Sonnet（2回呼び出し：クエリ生成 + 接続合成）
> **呼び出し箇所:** `src/lib/ai/pipeline.ts` の `generateConnection()` 関数

---

## 設計原則

**P3の仕事は「翻訳」ではなく「跳躍」。**

ユーザーの気づきをそのまま英語にして検索するのではなく、気づきの**構造**を抽出し、その構造が別のドメインで現れている事例を探す。

- ❌ 「ロケ地の飲食店は質が高い」→ `"location scouting restaurant quality"` （翻訳）
- ✅ 「ある目的で選ばれたものは別の目的でも質が高い」→ `"Michelin guide unintended quality signal"` （跳躍）

**意外性の源泉は検索クエリにある。** 接続合成プロンプトがどんなに優秀でも、検索結果が平凡なら出力も平凡。

---

## プロンプト①：検索クエリ生成

### system

```
You generate web search queries that find SURPRISING connections.

Your job is NOT to translate the memo into English.
Your job IS to find where the same STRUCTURE appears in a completely different domain.

Process:
1. Extract the abstract structure from the memo (the "abstract_principle" field helps)
2. Think of a domain FAR from the memo's original context
3. Generate a query that finds a SPECIFIC example in that distant domain

The query must contain at least one proper noun or specific term (company name, theory name, person name, product name).
```

### user

```
Memo summary: ${input.summary}
Core structure: ${input.abstract_principle}
Keywords: ${input.keywords.join(", ")}

Search angle: ${angle.label}
${angle.queryGuide}

User interest: ${persona.searchAngle}

Generate ONE English search query (4-8 words).
The query must target a specific example in a domain DIFFERENT from: ${input.domain}

Good examples:
- Memo about waiting in line → "Disney queue design psychology research"
- Memo about meeting silence → "bystander effect Kitty Genovese diffusion responsibility"
- Memo about restaurant location scouting → "Michelin guide unintended quality signal"

Bad examples:
- "restaurant quality curation" (just translating the memo)
- "business model innovation" (too generic, no proper noun)
- "interesting examples quality" (meaningless)
```

### 変更点
- systemを「翻訳するな、跳躍しろ」に明確化
- **queryGuide**を新設（後述）。searchBiasの英語キーワード羅列を廃止
- Good/Bad examplesを3つずつ追加（few-shot）
- 「domain DIFFERENT from」で元ドメインからの脱出を強制
- 「at least one proper noun」で具体性を強制

---

## SEARCH_ANGLES の再設計

```typescript
export const SEARCH_ANGLES = {
  business_model: {
    label: "仕組みの視点",
    searchBias: "business model service company startup case study",
    queryGuide: `Find a business, service, or system that solved the same structural problem.
The example should include a company name, product name, or specific mechanism.
Prefer lesser-known examples over obvious ones (avoid GAFA unless truly surprising).`,
  },
  psychology: {
    label: "人の心の視点",
    searchBias: "psychology behavioral economics cognitive bias experiment",
    queryGuide: `Find a psychology experiment, cognitive bias, or behavioral economics finding that explains WHY this structure exists in human behavior.
The example should include a researcher name, experiment name, or theory name.
Prefer experiments with concrete numbers (sample size, effect size, year).`,
  },
  cross_domain: {
    label: "異分野の視点",
    searchBias: "analogy pattern biology physics architecture",
    queryGuide: `Find the same pattern in a completely unrelated field: biology, physics, music, military, sports, cooking, architecture.
The more distant the field, the better.
The example should be specific enough that the user can look it up.`,
  },
} as const;
```

### 変更点
- **queryGuide** を新設。searchBiasは検索クエリに混ぜるバイアスワードとして残す
- queryGuideは「何を探すか」の具体的指示。searchBiasは「検索エンジンに渡すヒント」
- 各アングルで「固有名詞を含めろ」の具体的な種類を指定（会社名 / 研究者名 / 分野名）

---

## プロンプト②：接続合成

### system

```
あなたは知的好奇心を刺激するリサーチャー。
ユーザーの日常の気づきに対して「え、そうなの？」「面白い！」と思える外部知識を紐づける。

# あなたの角度
${angle.queryGuide}

# ユーザーの関心傾向
${persona.promptInstruction}
${profileSection}
${fbSection}

# 出力ルール
- title: その外部知識を一言で（12-18字）。固有名詞を必ず1つ含める
- description: 3文構成
  - 1文目: 事実（数字・固有名詞・年号を含める）
  - 2文目: その事実の意味や背景
  - 3文目: ユーザーの気づきとの構造的な接続（「〜と同じ構造だ」「〜の裏返しだ」等）
- 「〜してみてください」「〜かもしれません」禁止。断定調
- 検索結果に良い情報がない場合、無理に接続を作らない。quality_scoreを0.3以下にする

# 品質チェック（出力前に自問）
1. ユーザーが「へぇ、そうなんだ」と声に出すか？ → 出さないなら固有名詞か数字が足りない
2. ユーザーの元の気づきと「同じ構造」が見えるか？ → 見えないなら3文目が弱い
3. ユーザーが検索結果のURLを開きたくなるか？ → ならないなら具体性が足りない
```

### user

```
# ユーザーの気づき
要点: ${input.summary}
キーワード: ${input.keywords.join(", ")}
本質: ${input.abstract_principle}
原文: ${input.transcript}

# 検索結果
${searchResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`).join("\n\n")}

以下のJSON形式で知識を1つ紐づけ:
{
  "title": "見出し（固有名詞を含む、12-18字）",
  "description": "3文。1文目=事実、2文目=意味、3文目=接続",
  "source_url": "URL",
  "source_title": "引用元タイトル"
}

検索結果の質が低い場合（メモと構造的に無関係、具体性がない等）は以下を返せ:
{
  "title": "",
  "description": "",
  "source_url": null,
  "source_title": null,
  "low_quality": true
}
```

### 変更点
- **title文字数を12-18字に絞った**（10-25字→12-18字）
- **description を3文構成に構造化**（事実→意味→接続）。「2-3文」の曖昧指示を廃止
- **quality_scoreの自己採点を廃止**。代わりにlow_qualityフラグで「接続できなかった」を明示させる
- **品質チェックの自問を追加**（思考の強制）
- promptGuideをqueryGuideに名称変更（角度の指示であることを明確化）

---

## quality_score の扱い

LLMの自己採点は信頼できない。以下に変更：

```typescript
// quality_scoreはルールベースで算出
function calcQualityScore(result: ParsedResult, searchResults: SearchResult[]): number {
  let score = 0.5; // ベース

  // 固有名詞がtitleに含まれるか（カタカナ or 英字の連続）
  if (/[A-Z][a-z]+|[ァ-ヴー]{3,}/.test(result.title)) score += 0.15;

  // descriptionに数字が含まれるか
  if (/\d{2,}/.test(result.description)) score += 0.1;

  // source_urlが存在するか
  if (result.source_url) score += 0.1;

  // descriptionが50字以上あるか
  if (result.description.length >= 50) score += 0.1;

  // low_qualityフラグ
  if (result.low_quality) return 0.2;

  return Math.min(score, 1.0);
}
```

---

## テストケース

### Case 1: ロケ地の飲食店
**入力:**
- summary: ロケ地になる飲食店って、総じていいお店が多い気がする
- abstract_principle: ある目的で選ばれたものは、別の目的でも質が高い
- domain: 生活
- searchAngle: business_model / persona: builder

**期待されるクエリの方向:**
- `"Michelin guide tire company quality restaurant signal"` — ミシュランの本来の目的（タイヤ販売促進）と副産物（品質証明）
- `"airport lounge Priority Pass quality spillover"` — ラウンジの選別基準が別の品質保証になる
- `"Y Combinator batch selection startup quality signal"` — YCの選別が投資家の代理指標になる

**NGクエリ:**
- `"restaurant location scouting quality"` — メモの翻訳
- `"food quality curation"` — 抽象的すぎ

### Case 2: 会議の沈黙
**入力:**
- summary: 会議で最初の発言者が出るまでの沈黙
- abstract_principle: 集団行動の開始には一人の逸脱者が必要である
- domain: 仕事
- searchAngle: psychology / persona: grower

**期待されるクエリの方向:**
- `"bystander effect Darley Latane 1968 experiment"` — 傍観者効果の原典
- `"first follower movement Derek Sivers TED"` — 最初のフォロワー理論
- `"ice breaker effect Solomon Asch conformity"` — 同調圧力の解除

### Case 3: 制約と創造性
**入力:**
- summary: 制約がある方が創造性が高まる
- abstract_principle: 制約は選択肢を削減することで創造的跳躍を促進する
- domain: 趣味
- searchAngle: cross_domain / persona: creator

**期待されるクエリの方向:**
- `"Dogme 95 Lars von Trier film constraints creativity"` — 映画の制約ルール
- `"Twitter 140 character limit creativity constraint"` — 文字数制限が生んだ表現
- `"haiku syllable constraint poetic innovation"` — 俳句の型が生む創造

---

## 実装上の注意

1. **検索クエリが翻訳になっていないかのバリデーション:** summaryのキーワードがそのままクエリに入っていたら再生成させる（リトライ1回）
2. **low_quality時のフォールバック:** 別のsearchAngleで再試行。3アングル全部失敗したらユーザーに「この気づきに接続する外部知識が見つかりませんでした」を表示
3. **Brave Search の結果数:** 現状3件。5件に増やす。3件だと当たりが入る確率が低い
