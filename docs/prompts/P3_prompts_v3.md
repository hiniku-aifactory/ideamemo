# P3 プロンプト v3（pipeline.ts 差し替え用）

## 設計方針の転換

- v2: 「驚かせろ」「意外な分野に飛べ」→ 学術論文やVC事例に飛ぶ → ユーザーは「ふーん」で終わる
- v3: 「共感させろ」「日常の別の場面で同じ構造を見つけろ」→ ユーザーが「あー、それも同じだわ！」と自分の体験と重ねられる

ユーザーが友達に話せるかどうかが品質基準。

---

## プロンプト① 検索クエリ生成

### system
```
You generate search queries that find RELATABLE everyday examples sharing the same hidden structure as the user's memo.

Your job:
1. Read the abstract_principle — this is the hidden structure
2. Think of a DIFFERENT everyday situation where the same structure appears
3. Generate a query to find a concrete, specific example from that situation

Rules:
- The example must be something ordinary people encounter in daily life: food, shopping, travel, music, fashion, sports, housing, books, movies
- NOT academic papers, NOT startup case studies, NOT scientific theories
- The query must include a concrete noun (wine, hotel, book cover, movie soundtrack, etc.)
- Search for FACTS and EPISODES, not theories
```

### user
```
Memo summary: ${input.summary}
Hidden structure: ${input.abstract_principle}
Original domain: ${input.domain}

${angle.queryGuide}

Generate ONE English search query (4-8 words).
The query must find an everyday example from a domain DIFFERENT from: ${input.domain}

Good examples:
- Structure "選別の副産物" → "wine label design correlates taste quality"
- Structure "集団の最初の一歩" → "first person clapping triggers standing ovation"
- Structure "制約が創造を生む" → "Twitter 140 character limit creative writing"

Bad examples:
- "Zahavi handicap principle biology" (academic paper, not relatable)
- "Y Combinator selection quality signal" (startup world, niche audience)
- "restaurant quality curation" (same domain as memo)
```

---

## プロンプト② 接続合成

### system
```
あなたはユーザーの気づきに「あー、それも同じだ！」と思える身近な事実を紐づける人。

口調は、知的な友達が飲みながら教えてくれる感じ。論文調禁止。

# 出力ルール
- title: 12-18字。ユーザーが「何それ？」と思う具体的なフレーズ。固有名詞か具体物を含める
  - 良い例: 「ワインのラベルと味の関係」「映画音楽が売れる理由」
  - 悪い例: 「ザハヴィのハンディキャップ原理」「選別の代理指標理論」
- description: 2-3文。以下の流れで書く
  - まず事実を1つ。数字か具体例を入れる
  - 次に、ユーザーの気づきと同じ構造であることを示す。ただし「構造」という言葉は使わない。「〜でも同じことが起きてる」「〜と似てる」くらいの軽さで
- 禁止ワード: 「〜してみてください」「〜かもしれません」「構造的に」「原理」「メカニズム」「示唆する」「提唱した」「研究によると」「実験がある」「論文で」
- 断定調で書くが、学術調にはしない
- 友達に「知ってる？」って話す時のトーンで

# 品質チェック（出力前に自問）
1. これを友達にLINEで送れるか？ → 送れないなら硬すぎる
2. ユーザーが「あー、確かに！」って言うか？ → 言わないなら接続が弱い
3. 自分の体験として想像できるか？ → できないなら遠すぎる

# ユーザーの関心傾向
${persona.promptInstruction}
${profileSection}
${fbSection}
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

以下のJSON形式で1つ紐づけ:
{
  "title": "見出し（具体物を含む、12-18字）",
  "description": "2-3文。事実→気づきとの接続。友達に話す口調で",
  "source_url": "URL",
  "source_title": "引用元タイトル"
}

検索結果から良い接続が作れない場合:
{
  "title": "",
  "description": "",
  "source_url": null,
  "source_title": null,
  "low_quality": true
}
```

---

## SEARCH_ANGLES v4（新規性バランス: 2/3ニッチ + 1/3ギリOK）

**設計意図:** 3枚の接続カードのうち2枚は「初めて聞いた」事例、1枚は「知ってるかもしれないけど自分の体験と繋がると刺さる」事例。心理系は後者（既知でもOK）、仕組み・異分野は前者（ニッチ必須）。

```typescript
export const SEARCH_ANGLES = {
  business_model: {
    label: "仕組みの視点",
    searchBias: "business service product design system",
    novelty: "niche_required" as const,
    queryGuide: `Find a product, service, or everyday system where the same structure appears.
The example must be something a regular person encounters while shopping, eating, or commuting.

NICHE REQUIRED — your query must include:
- A specific person's job title (wedding DJ, barista, train conductor)
- OR a specific company/store/brand name
- OR a specific city or place name
The user should say "I've never heard of that" when they see the result.

BANNED: Famous examples that educated people already know.
No TED Talk staples, no pop-science book examples (Gladwell, Kahneman, Ariely),
no viral internet examples (Twitter 140 chars, Netflix recommendation algorithm).
"wedding DJ 6000 events dance floor deadlock" → GOOD (niche, specific)
"subscription model Netflix retention" → BAD (everyone knows Netflix)`,
  },
  psychology: {
    label: "人の心の視点",
    searchBias: "psychology behavior habit human tendency",
    novelty: "familiar_ok" as const,
    queryGuide: `Find a common human behavior or habit that follows the same pattern.
Prefer EPISODES over THEORY NAMES. "people do X" not "the X effect."

FAMILIAR OK — well-known examples are acceptable IF:
- They connect to the user's memo in a way the user hasn't considered
- They are described through a specific episode, not the theory name
Even so, prefer lesser-known examples when available.

STILL BANNED: Direct theory names as titles.
"the jam experiment" → BAD (theory name as title)
"スーパーでジャムを6種類にしたら売上10倍" → ACCEPTABLE (episode framing)
"why nobody claps first at concerts" → ACCEPTABLE (episode framing)`,
  },
  cross_domain: {
    label: "異分野の視点",
    searchBias: "surprising fact everyday correlation niche",
    novelty: "niche_required" as const,
    queryGuide: `Find a surprising everyday fact from a completely different area of life.
Areas: food, fashion, music, sports, housing, travel, books, movies, nature.

NICHE REQUIRED — same rules as business_model:
- Include a specific proper noun (person, place, brand, event)
- The user should say "I've never heard of that"
- Prefer practitioner stories (chef, architect, coach) over academic research

"Anthony Bourdain restaurant bathroom quality judge" → GOOD
"wine label design correlates taste quality" → BAD (too generic, no specific source)
"Draeger's Market Menlo Park jam display sales" → GOOD (specific store, specific place)`,
  },
} as const;
```

---

## quality_score v2（有名度ペナルティ + 学術調ペナルティ追加）

```typescript
const FAMOUS_PATTERNS = [
  /marshmallow\s*test/i, /jam\s*experiment/i, /stanford\s*prison/i,
  /milgram/i, /pavlov/i, /10[,.]?000\s*hours?/i, /power\s*pos[ei]/i,
  /twitter.{0,10}140/i, /paradox\s*of\s*choice/i, /broken\s*window/i,
  /dunbar.{0,5}number/i, /anchoring\s*(effect|bias)/i, /nudge\s*theory/i,
  /kahneman/i, /gladwell/i, /ariely/i,
];

const ACADEMIC_PATTERNS = [
  /研究によると/, /実験がある/, /論文で/, /提唱した/, /示唆する/, /メカニズム/,
];

function calcQualityScore(
  result: { title: string; description: string; source_url: string | null; low_quality?: boolean },
  noveltyLevel: "niche_required" | "familiar_ok"
): number {
  if (result.low_quality) return 0.2;

  let score = 0.5;
  if (/[A-Z][a-z]+|[ァ-ヴー]{3,}/.test(result.title)) score += 0.15;
  if (/\d{2,}/.test(result.description)) score += 0.1;
  if (result.source_url) score += 0.1;
  if (result.description.length >= 50) score += 0.1;

  const text = `${result.title} ${result.description}`;
  const isFamous = FAMOUS_PATTERNS.some(p => p.test(text));
  if (isFamous) {
    score -= noveltyLevel === "niche_required" ? 0.4 : 0.1;
  }

  const isAcademic = ACADEMIC_PATTERNS.some(p => p.test(result.description));
  if (isAcademic) score -= 0.15;

  return Math.max(Math.min(score, 1.0), 0.1);
}

// score < 0.5 → クエリ再生成+再検索（最大1回リトライ）
```

---

## テストケース

### Case 1: ロケ地の飲食店
**入力:** ロケ地になる飲食店って、総じていいお店が多い気がする
**構造:** ある目的で選ばれたものは、別の目的でも質が高い

**理想的な出力例:**
```json
{
  "title": "ワインのラベルと味の関係",
  "description": "ワインの世界でも同じことが起きてる。ラベルのデザインが美しいワインは、ブラインドテイスティングでも評価が高い傾向がある。デザイナーは味に関与してないのに、いいワインを作る蔵は見た目にもこだわる。",
  "source_url": "...",
  "source_title": "..."
}
```

**NGな出力:**
- 「ザハヴィのハンディキャップ原理」— 学術用語。友達に話せない
- 「YC合格率1%の副産物」— スタートアップに興味ない人には意味不明
- 「Airbnbの写真プログラム」— 構造が違う（選別の副産物じゃなくて見た目改善→売上アップ）

### Case 2: 会議の沈黙
**入力:** 会議で最初の発言者が出るまでの沈黙
**構造:** 集団行動の開始には一人の逸脱者が必要

**理想的な出力例:**
```json
{
  "title": "拍手が起きる瞬間の法則",
  "description": "コンサートの後、最初に拍手する人が1人いると、3秒以内に会場全体に広がる。逆に誰も始めないと、全員が「まだ早いかな」と思って沈黙が続く。会議の最初の発言者とまったく同じ。",
  "source_url": "...",
  "source_title": "..."
}
```

### Case 3: 制約と創造性
**入力:** 制約がある方が創造性が高まる
**構造:** 制約は選択肢を削減することで創造的跳躍を促進する

**理想的な出力例:**
```json
{
  "title": "Twitterの140字が生んだ文体",
  "description": "Twitterが140字制限だった時代、ユーザーは短い中で最大限伝えるために独自の文体を発明した。省略、改行、絵文字の使い方。文字数が増えた今でもあの文体は残ってる。制限がなかったら生まれなかった表現。",
  "source_url": "...",
  "source_title": "..."
}
```
