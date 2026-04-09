const BRAVE_API_KEY = process.env.BRAVE_SEARCH_API_KEY;

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function searchBrave(query: string, count: number = 3): Promise<BraveSearchResult[]> {
  if (!BRAVE_API_KEY) {
    console.warn("[Brave] API key not set, returning empty results");
    return [];
  }

  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": BRAVE_API_KEY,
      },
    }
  );

  if (!res.ok) {
    console.error("[Brave] Search failed:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  return (data.web?.results ?? []).map((r: { title: string; url: string; description: string }) => ({
    title: r.title,
    url: r.url,
    description: r.description,
  }));
}
