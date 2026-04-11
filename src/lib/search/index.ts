/**
 * 統合検索モジュール
 * Brave Search → Gemini Grounding のフォールバック構成
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string; // Brave: description, Gemini: groundingTextから切り出し
}

export interface SearchResponse {
  results: SearchResult[];
  groundingText: string; // Geminiの場合のみ。Braveの場合は空
  source: "brave" | "gemini" | "none";
}

// --- Brave Search ---

async function searchBrave(query: string, count = 5): Promise<SearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": key,
        },
      }
    );

    if (!res.ok) {
      console.warn(`[Search] Brave returned ${res.status}`);
      return [];
    }

    const data = await res.json();
    return (data.web?.results ?? []).map(
      (r: { title: string; url: string; description: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.description ?? "",
      })
    );
  } catch (e) {
    console.warn("[Search] Brave error:", e instanceof Error ? e.message : e);
    return [];
  }
}

// --- Gemini Grounding (フォールバック) ---

interface GroundingChunk {
  web?: { title?: string; uri?: string };
}

async function searchGemini(query: string): Promise<{ results: SearchResult[]; groundingText: string }> {
  try {
    const { groundingSearchWithText } = await import("@/lib/ai/gemini");
    const { text, sources } = await groundingSearchWithText(query);
    const results: SearchResult[] = sources.map((s) => ({
      title: s.title,
      url: s.url,
      snippet: s.description || "",
    }));
    return { results, groundingText: text };
  } catch (e) {
    console.warn("[Search] Gemini fallback error:", e instanceof Error ? e.message : e);
    return { results: [], groundingText: "" };
  }
}

// --- 統合エントリーポイント ---

export async function search(query: string, count = 5): Promise<SearchResponse> {
  // 1. Brave Search を試行
  const braveResults = await searchBrave(query, count);
  if (braveResults.length > 0) {
    return { results: braveResults, groundingText: "", source: "brave" };
  }

  // 2. Brave失敗 → Gemini Groundingにフォールバック
  console.warn("[Search] Brave returned 0 results, falling back to Gemini Grounding");
  const gemini = await searchGemini(query);
  if (gemini.results.length > 0 || gemini.groundingText.trim()) {
    return { results: gemini.results, groundingText: gemini.groundingText, source: "gemini" };
  }

  // 3. 両方失敗
  return { results: [], groundingText: "", source: "none" };
}
