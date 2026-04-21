import * as cheerio from "cheerio";

const DDG_HTML_ENDPOINT = "https://duckduckgo.com/html/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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

export async function searchWeb(topic, maxResults = 6) {
  const searchUrl = `${DDG_HTML_ENDPOINT}?q=${encodeURIComponent(topic)}&kl=us-en`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html"
      },
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}`);
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

      if (!title || !decodedUrl || !isHttpUrl(decodedUrl) || seen.has(decodedUrl)) {
        return;
      }

      seen.add(decodedUrl);
      results.push({
        title,
        url: decodedUrl,
        snippet
      });
    });

    if (!results.length) {
      throw new Error("No search results found for this topic.");
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
}
