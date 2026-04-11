# P3 プロンプト（pipeline.ts 差し替え用）

---

## プロンプト① 検索クエリ生成

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

---

## プロンプト② 接続合成

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
- 検索結果に良い情報がない場合、無理に接続を作らない。low_quality: true を返す

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

---

## SEARCH_ANGLES 差し替え

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

---

## quality_score ルールベース算出

```typescript
function calcQualityScore(result: { title: string; description: string; source_url: string | null; low_quality?: boolean }): number {
  if (result.low_quality) return 0.2;

  let score = 0.5;

  // 固有名詞がtitleに含まれるか（カタカナ3文字以上 or 英大文字始まり）
  if (/[A-Z][a-z]+|[ァ-ヴー]{3,}/.test(result.title)) score += 0.15;

  // descriptionに数字が含まれるか
  if (/\d{2,}/.test(result.description)) score += 0.1;

  // source_urlが存在するか
  if (result.source_url) score += 0.1;

  // descriptionが50字以上あるか
  if (result.description.length >= 50) score += 0.1;

  return Math.min(score, 1.0);
}
```
