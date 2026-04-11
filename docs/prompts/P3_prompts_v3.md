# P3 プロンプト v5（pipeline.ts 差し替え用）

## 設計方針の変遷

- v2: 「驚かせろ」→ 学術論文やVC事例に飛ぶ → ユーザーは「ふーん」で終わる
- v3: 「共感させろ」→ 日常の身近な事実を接続 → ✅ 身近だが「知ってる」リスク
- v4: 新規性バランス（2/3ニッチ+1/3ギリOK）+ 有名度ペナルティ → ✅ だが固定3アングルに設計的欠陥
- **v5: 固定アングル廃止。3枚とも「異分野」に統一。AIが毎回メモに合った3ドメインを動的選択。過去履歴参照で多様性担保**

ユーザーが友達に話せるかどうかが品質基準。

---

## プロンプト⓪ ドメイン選択（v5で新設）

接続生成の最初のステップ。メモの構造に対して「この構造が現れそうな3つの異分野」をAIが選ぶ。

### system
```
You select 3 domains where a given abstract structure might appear in everyday life.

Your job:
1. Read the abstract_principle
2. Pick 3 domains from the DOMAIN_POOL where this structure plausibly appears
3. The 3 domains must be DIFFERENT from each other AND from the memo's original domain

DOMAIN_POOL:
food, fashion, music, sports, housing, travel, books, movies, nature,
architecture, games, education, medicine, agriculture, craft,
transportation, hospitality, retail, performing_arts, manufacturing

Rules:
- Pick domains where you can imagine a SPECIFIC episode, not just a vague connection
- Spread across different "worlds" — don't pick 3 that are similar (e.g. fashion + retail + craft)
- DO NOT pick domains just because YOU can think of a famous example there
  → If the first thing that comes to mind is a TED Talk or pop-science book, that domain is contaminated — pick a different one
- Prefer domains that would SURPRISE the user as a connection point
```

### user
```
Abstract structure: ${input.abstract_principle}
Original domain: ${input.domain}

${historySection}

Pick 3 domains from the DOMAIN_POOL.
Output JSON only:
{
  "domains": [
    {"domain": "...", "reason": "why this structure appears here (1 sentence)"},
    {"domain": "...", "reason": "..."},
    {"domain": "...", "reason": "..."}
  ]
}
```

### 履歴セクション生成

```typescript
function buildHistorySection(userId: string): string {
  // 直近20件の接続カードから使用ドメイン+事例タイトルを取得
  const recent = await getRecentConnections(userId, 20);

  if (recent.length === 0) return "";

  const usedDomains = recent.map(c => c.domain).filter(Boolean);
  const usedTitles = recent.map(c => c.title);

  const domainCounts: Record<string, number> = {};
  usedDomains.forEach(d => { domainCounts[d] = (domainCounts[d] || 0) + 1; });

  // 3回以上使われたドメインを「過剰使用」として列挙
  const overused = Object.entries(domainCounts)
    .filter(([_, count]) => count >= 3)
    .map(([domain]) => domain);

  let section = `\nDIVERSITY CONSTRAINT:\n`;
  if (overused.length > 0) {
    section += `These domains have been used 3+ times recently. AVOID them: ${overused.join(", ")}\n`;
  }
  section += `\nRecent card titles (DO NOT generate similar topics):\n`;
  usedTitles.slice(0, 10).forEach(t => { section += `- ${t}\n`; });

  return section;
}
```

---

## プロンプト① 検索クエリ生成

### system
```
You generate search queries that find RELATABLE everyday examples sharing the same hidden structure as the user's memo.

Your job:
1. Read the abstract_principle — this is the hidden structure
2. You are given a target domain — find a concrete, specific example from THAT domain
3. Generate a query to find it via web search

Rules:
- The example must be something ordinary people encounter in daily life
- NOT academic papers, NOT startup case studies, NOT scientific theories
- The query must include a concrete noun specific to the target domain
- Search for FACTS and EPISODES, not theories
- DO NOT generate a query to confirm something you already know
  → If you already have an example in mind, your query is biased. Try to find something you DON'T know
- Include a specific proper noun (person, place, brand, event) when possible
```

### user
```
Memo summary: ${input.summary}
Hidden structure: ${input.abstract_principle}
Original domain: ${input.domain}
Target domain: ${targetDomain}
Novelty level: ${noveltyLevel}

${noveltyLevel === "niche_required"
  ? "NICHE REQUIRED: The user should say 'I've never heard of that.' Include a specific person's job title, company name, or place name. BANNED: TED Talk staples, pop-science examples (Gladwell, Kahneman, Ariely), viral internet examples."
  : "FAMILIAR OK: Well-known examples acceptable IF framed as specific episodes, not theory names. Still prefer lesser-known examples."}

${recentTitlesSection}

Generate ONE English search query (4-8 words).

Good: "Michelin inspector restaurant bathroom quality" (niche, specific person)
Good: "Tokyo ramen shop first customer line effect" (specific place)
Bad: "paradox of choice consumer behavior" (academic, famous)
Bad: "Netflix recommendation algorithm" (everyone knows this)
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

## ドメイン選択 + noveltyバランス v5

**設計転換（v4→v5）:** 固定3アングル（仕組み/人の心/異分野）を廃止。3枚とも「異分野」にして、AIが毎回メモに合った3ドメインを動的に選ぶ。

**新規性バランス:** 3枚中2枚は`niche_required`（初めて聞いた）、1枚は`familiar_ok`（知ってるかもだけどギリOK）。`familiar_ok`枠はランダムで1つ選ぶ。

**多様性担保:** 過去の使用ドメイン+事例タイトルをプロンプトに渡し、被りを防ぐ。3回以上使用されたドメインは回避指示。

```typescript
const DOMAIN_POOL = [
  "food", "fashion", "music", "sports", "housing",
  "travel", "books", "movies", "nature", "architecture",
  "games", "education", "medicine", "agriculture", "craft",
  "transportation", "hospitality", "retail", "performing_arts", "manufacturing",
] as const;

type NoveltyLevel = "niche_required" | "familiar_ok";

interface DomainSelection {
  domain: string;
  reason: string;
  novelty: NoveltyLevel;
}

async function selectDomainsAndNovelty(
  input: StructuredMemo,
  userId: string
): Promise<DomainSelection[]> {
  // Step 1: AIにドメイン選択させる（プロンプト⓪）
  const historySection = await buildHistorySection(userId);
  const response = await callDomainSelection(input, historySection);
  const domains: { domain: string; reason: string }[] = response.domains;

  // Step 2: noveltyバランスを付与（2/3ニッチ + 1/3ギリOK）
  const familiarIndex = Math.floor(Math.random() * 3);
  return domains.map((d, i) => ({
    ...d,
    novelty: i === familiarIndex ? "familiar_ok" : "niche_required",
  }));
}
```

### パイプライン全体フロー（v5）

```
メモ → P2構造化
  ↓
プロンプト⓪: ドメイン選択（3ドメイン）← 過去履歴を入力
  ↓
3ドメイン × それぞれ:
  プロンプト①: クエリ生成（ドメイン+noveltyLevel指定）
  ↓
  Gemini Grounding 検索
  ↓
  プロンプト②: 接続合成
  ↓
  quality_score判定 → score < 0.5ならリトライ（1回）
  ↓
接続カード3枚
```

---

## quality_score v3（ドメイン動的選択対応）

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
  noveltyLevel: NoveltyLevel,
  recentTitles: string[] // 過去の事例タイトル
): number {
  if (result.low_quality) return 0.2;

  let score = 0.5;

  // 基本加点
  if (/[A-Z][a-z]+|[ァ-ヴー]{3,}/.test(result.title)) score += 0.15;
  if (/\d{2,}/.test(result.description)) score += 0.1;
  if (result.source_url) score += 0.1;
  if (result.description.length >= 50) score += 0.1;

  // 有名度ペナルティ
  const text = `${result.title} ${result.description}`;
  if (FAMOUS_PATTERNS.some(p => p.test(text))) {
    score -= noveltyLevel === "niche_required" ? 0.4 : 0.1;
  }

  // 学術調ペナルティ
  if (ACADEMIC_PATTERNS.some(p => p.test(result.description))) {
    score -= 0.15;
  }

  // 過去事例との重複ペナルティ（タイトル類似度チェック）
  const isDuplicate = recentTitles.some(t =>
    result.title.includes(t.slice(0, 6)) || t.includes(result.title.slice(0, 6))
  );
  if (isDuplicate) score -= 0.3;

  return Math.max(Math.min(score, 1.0), 0.1);
}

// score < 0.5 → クエリ再生成+再検索（最大1回リトライ）
```

---

## DDL追記（connectionsテーブル拡張）

```sql
-- 接続カードの生成元ドメインを記録（多様性担保用）
ALTER TABLE connections ADD COLUMN IF NOT EXISTS search_domain text;
-- search_domain: "food", "music", "nature" 等。DOMAIN_POOLの値
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
