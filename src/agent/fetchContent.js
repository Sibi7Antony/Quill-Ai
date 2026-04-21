/**
 * Wikipedia Content Fetcher — 100% free, no API key needed.
 * Uses the Wikipedia REST API to get full article text for any title.
 */

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/**
 * Fetch and extract clean text from a Wikipedia article.
 */
export async function fetchPageContent(url) {
  try {
    // Extract Wikipedia article title from the URL
    const match = url.match(/wikipedia\.org\/wiki\/(.+)$/);
    if (!match) return null;

    const title = decodeURIComponent(match[1]);

    const apiUrl = new URL(WIKI_API);
    apiUrl.searchParams.set("action", "query");
    apiUrl.searchParams.set("prop", "extracts");
    apiUrl.searchParams.set("explaintext", "1");   // plain text, no HTML
    apiUrl.searchParams.set("exsectionformat", "plain");
    apiUrl.searchParams.set("titles", title);
    apiUrl.searchParams.set("format", "json");
    apiUrl.searchParams.set("origin", "*");
    apiUrl.searchParams.set("exlimit", "1");

    const response = await fetch(apiUrl.toString(), {
      headers: { "User-Agent": "QuillAI/1.0 (educational research tool)" }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const pages = data?.query?.pages || {};
    const page = Object.values(pages)[0];

    if (!page || page.missing !== undefined || !page.extract) return null;

    // Return first 8000 chars of the article
    return page.extract.slice(0, 8000).trim();
  } catch {
    return null;
  }
}
