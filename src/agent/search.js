/**
 * Wikipedia Search — 100% free, no API key, works from any server/cloud.
 * Uses the Wikipedia REST API to search articles and fetch content.
 */

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary";

/**
 * Search Wikipedia for relevant articles matching the topic.
 */
async function wikiSearch(topic, maxResults) {
  const url = new URL(WIKI_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", topic);
  url.searchParams.set("srlimit", String(maxResults + 2));
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const response = await fetch(url.toString(), {
    headers: { "User-Agent": "QuillAI/1.0 (educational research tool)" }
  });

  if (!response.ok) {
    throw new Error(`Wikipedia search failed (${response.status})`);
  }

  const data = await response.json();
  const searchResults = data?.query?.search || [];

  if (!searchResults.length) {
    throw new Error(`No Wikipedia results found for "${topic}".`);
  }

  return searchResults.slice(0, maxResults).map((r) => ({
    title: r.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
    snippet: r.snippet
      ? r.snippet.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim()
      : ""
  }));
}

/**
 * Main export — searches Wikipedia (free, no API key needed).
 */
export async function searchWeb(topic, maxResults = 6) {
  console.log(`[search] Wikipedia search for: "${topic}"`);
  return wikiSearch(topic, maxResults);
}
