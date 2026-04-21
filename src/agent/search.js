import * as cheerio from "cheerio";

/* ─── Brave Search API (production) ─── */
const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

/* ─── DuckDuckGo HTML scrape (local dev fallback) ─── */
const DDG_HTML_ENDPOINT = "https://duckduckgo.com/html/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/* ─── Brave Search ─── */
async function searchBrave(topic, maxResults) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  const url = `${BRAVE_ENDPOINT}?q=${encodeURIComponent(topic)}&count=${maxResults}&search_lang=en`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey
    }
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Brave Search failed (${response.status}): ${reason.slice(0, 200)}`);
  }

  const data = await response.json();
  const results = (data.web?.results || [])
    .slice(0, maxResults)
    .map((r) => ({
      title: r.title || "",
      url: r.url || "",
      snippet: r.description || ""
    }))
    .filter((r) => r.title && r.url);

  if (!results.length) {
    throw new Error("No search results found for this topic.");
  }

  return results;
}

/* ─── DuckDuckGo HTML scrape (local dev only) ─── */
function decodeResultUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl, DDG_HTML_ENDPOINT);
    const redirectTarget = parsed.searchParams.get("uddg");
    if (redirectTarget) return decodeURIComponent(redirectTarget);
    return parsed.toString();
  } catch {
    return null;
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function searchDDG(topic, maxResults) {
  const searchUrl = `${DDG_HTML_ENDPOINT}?q=${encodeURIComponent(topic)}&kl=us-en`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(searchUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed with status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    const seen = new Set();

    $(".result").each((_, element) => {
      if (results.length >= maxResults) return false;
      const titleEl = $(element).find(".result__a").first();
      const title = titleEl.text().trim();
      const snippet = $(element).find(".result__snippet").first().text().trim();
      const decodedUrl = decodeResultUrl(titleEl.attr("href"));

      if (!title || !decodedUrl || !isHttpUrl(decodedUrl) || seen.has(decodedUrl)) return;
      seen.add(decodedUrl);
      results.push({ title, url: decodedUrl, snippet });
    });

    if (!results.length) throw new Error("No search results found for this topic.");
    return results;
  } finally {
    clearTimeout(timer);
  }
}

/* ─── Main export: Brave in production, DDG locally ─── */
export async function searchWeb(topic, maxResults = 6) {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;

  if (braveKey) {
    console.log("[search] Using Brave Search API");
    return searchBrave(topic, maxResults);
  }

  // Local dev fallback — may be blocked from cloud IPs
  console.log("[search] No BRAVE_SEARCH_API_KEY found — falling back to DuckDuckGo (local dev only)");
  return searchDDG(topic, maxResults);
}
