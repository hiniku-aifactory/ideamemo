import { PERSONA_MAP, type PersonaId } from "@/lib/personas";

// --- 型定義 ---

export interface PipelineInput {
  summary: string;
  keywords: string[];
  abstract_principle: string;
  domain: string;
  transcript: string;
  personaId: PersonaId;
  userId: string;
  userProfile?: Record<string, unknown>;
  feedbackHistory?: { positive: string[]; negative: string[] };
}

export interface PipelineOutput {
  title: string;
  description: string;
  source_url: string | null;
  source_title: string | null;
  quality_score: number;
  search_domain: string;
}

type NoveltyLevel = "niche_required" | "familiar_ok";

interface SearchResult {
  title: string;
  url: string;
}

// --- 品質判定パターン ---

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
  recentTitles: string[]
): number {
  if (result.low_quality) return 0.2;

  let score = 0.5;

  if (/[A-Z][a-z]+|[ァ-ヴー]{3,}/.test(result.title)) score += 0.15;
  if (/\d{2,}/.test(result.description)) score += 0.1;
  if (result.source_url) score += 0.1;
  if (result.description.length >= 50) score += 0.1;

  const text = `${result.title} ${result.description}`;
  if (FAMOUS_PATTERNS.some((p) => p.test(text))) {
    score -= noveltyLevel === "niche_required" ? 0.4 : 0.1;
  }
  if (ACADEMIC_PATTERNS.some((p) => p.test(result.description))) {
    score -= 0.15;
  }

  const isDuplicate = recentTitles.some(
    (t) => result.title.includes(t.slice(0, 6)) || t.includes(result.title.slice(0, 6))
  );
  if (isDuplicate) score -= 0.3;

  return Math.max(Math.min(score, 1.0), 0.1);
}

// 履歴セクション（TODO: Supabase接続後に直近20件から生成）
async function buildHistorySection(_userId: string): Promise<string> {
  return "";
}

// --- プロンプト定数 ---
// docs/prompts/P3_prompts_v3.md から引用

const DOMAIN_SELECTION_SYSTEM = `You select 3 domains where a given abstract structure might appear in everyday life.

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
  → If the first thing that comes to mind is a WELL-KNOWN example (famous company, iconic product, viral video, pop-science book, TED Talk, or widely-cited case study), that domain is contaminated — pick a different one
- Prefer domains that would SURPRISE the user as a connection point`;

const QUERY_GEN_SYSTEM = `You generate search queries that find RELATABLE everyday examples sharing the same hidden structure as the user's memo.

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
- Include a specific proper noun (person, place, brand, event) when possible`;

const SYNTHESIS_SYSTEM_BASE = `あなたはユーザーの気づきに「あー、それも同じだ！」と思える身近な事実を紐づける人。

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
3. 自分の体験として想像できるか？ → できないなら遠すぎる`;

// --- メイン処理 ---

export async function generateConnections(input: PipelineInput): Promise<PipelineOutput[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { groundingSearchWithText } = await import("./gemini");

  const persona = PERSONA_MAP[input.personaId];
  const historySection = await buildHistorySection(input.userId);

  const profileSection =
    input.userProfile && Object.keys(input.userProfile).length > 0
      ? `\n# ユーザープロファイル\n${JSON.stringify(input.userProfile)}`
      : "";
  const fbSection = input.feedbackHistory
    ? `\n# フィードバック傾向\n- 好む接続: ${input.feedbackHistory.positive.slice(0, 3).join("; ") || "まだなし"}\n- 嫌う接続: ${input.feedbackHistory.negative.slice(0, 3).join("; ") || "まだなし"}`
    : "";

  const synthesisSystem = `${SYNTHESIS_SYSTEM_BASE}

# ユーザーの関心傾向
${persona.promptInstruction}${profileSection}${fbSection}`;

  // プロンプト⓪: ドメイン選択
  const domainRes = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: DOMAIN_SELECTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Abstract structure: ${input.abstract_principle}
Original domain: ${input.domain}

${historySection}

Pick 3 domains from the DOMAIN_POOL.
Output JSON only:
{
  "domains": [
    {"domain": "...", "reason": "why this structure plausibly appears here — no specific scenario, just the general fit (1 sentence)"},
    {"domain": "...", "reason": "..."},
    {"domain": "...", "reason": "..."}
  ]
}`,
      },
    ],
  });

  const domainText = (domainRes.content[0] as { type: string; text: string }).text.trim();
  const domainJson = domainText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const domainParsed = JSON.parse(domainJson) as {
    domains: { domain: string; reason: string }[];
  };

  // noveltyバランス: ランダム1つを familiar_ok、残り2つを niche_required
  const familiarIndex = Math.floor(Math.random() * 3);
  const domainSelections = domainParsed.domains.slice(0, 3).map((d, i) => ({
    domain: d.domain,
    novelty: (i === familiarIndex ? "familiar_ok" : "niche_required") as NoveltyLevel,
  }));

  // 各ドメインを並列処理（プロンプト① → Grounding検索 → プロンプト②）
  const results = await Promise.all(
    domainSelections.map(async ({ domain, novelty }) => {
      const runOnce = async (): Promise<{
        parsed: Record<string, unknown>;
        sources: SearchResult[];
      }> => {
        // プロンプト①: クエリ生成
        const queryRes = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 100,
          system: QUERY_GEN_SYSTEM,
          messages: [
            {
              role: "user",
              content: `Memo summary: ${input.summary}
Hidden structure: ${input.abstract_principle}
Original domain: ${input.domain}
Target domain: ${domain}
Novelty level: ${novelty}

${
  novelty === "niche_required"
    ? "NICHE REQUIRED: The user should say 'I've never heard of that.' Include a specific person's job title, company name, or place name. BANNED: TED Talk staples, pop-science examples (Gladwell, Kahneman, Ariely), viral internet examples."
    : "FAMILIAR OK: Well-known examples acceptable IF framed as specific episodes, not theory names. Still prefer lesser-known examples."
}

Generate ONE English search query (4-8 words).

Good: "Michelin inspector restaurant bathroom quality" (niche, specific person)
Good: "Tokyo ramen shop first customer line effect" (specific place)
Bad: "paradox of choice consumer behavior" (academic, famous)
Bad: "Netflix recommendation algorithm" (everyone knows this)`,
            },
          ],
        });

        const searchQuery = (queryRes.content[0] as { type: string; text: string }).text.trim();

        // Gemini Grounding検索
        const { text: groundingText, sources } = await groundingSearchWithText(searchQuery);
        const searchResultsText =
          sources.length > 0
            ? sources.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}`).join("\n\n")
            : `[検索テキスト]\n${groundingText.slice(0, 500)}`;

        // プロンプト②: 接続合成
        const synthRes = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: synthesisSystem,
          messages: [
            {
              role: "user",
              content: `# ユーザーの気づき
要点: ${input.summary}
キーワード: ${input.keywords.join(", ")}
本質: ${input.abstract_principle}
原文: ${input.transcript}

# 検索結果
${searchResultsText}

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
}`,
            },
          ],
        });

        const synthText = (synthRes.content[0] as { type: string; text: string }).text.trim();
        const synthJson = synthText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(synthJson) as Record<string, unknown>;

        return { parsed, sources };
      };

      // 1回実行
      let { parsed, sources } = await runOnce();
      let quality = calcQualityScore(
        {
          title: (parsed.title as string) ?? "",
          description: (parsed.description as string) ?? "",
          source_url: (parsed.source_url as string | null) ?? null,
          low_quality: (parsed.low_quality as boolean) ?? false,
        },
        novelty,
        []
      );

      // quality < 0.5 なら1回リトライ
      if (quality < 0.5) {
        const retry = await runOnce();
        parsed = retry.parsed;
        sources = retry.sources;
        quality = calcQualityScore(
          {
            title: (parsed.title as string) ?? "",
            description: (parsed.description as string) ?? "",
            source_url: (parsed.source_url as string | null) ?? null,
            low_quality: (parsed.low_quality as boolean) ?? false,
          },
          novelty,
          []
        );
      }

      const firstSource = sources[0];

      return {
        title: (parsed.title as string) ?? "",
        description: (parsed.description as string) ?? "",
        source_url: (parsed.source_url as string | null) ?? firstSource?.url ?? null,
        source_title: (parsed.source_title as string | null) ?? firstSource?.title ?? null,
        quality_score: quality,
        search_domain: domain,
      } satisfies PipelineOutput;
    })
  );

  return results;
}
