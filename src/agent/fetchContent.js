import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "iframe",
  "form",
  "nav",
  "footer",
  "header",
  "aside"
];

function cleanText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function extractMainText(html) {
  const $ = cheerio.load(html);
  NOISE_SELECTORS.forEach((selector) => $(selector).remove());

  let text = cleanText($("article").first().text());
  if (text.length < 700) text = cleanText($("main").first().text());
  if (text.length < 700) text = cleanText($("body").text());

  return text.slice(0, 9000);
}

export async function fetchPageContent(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html"
      },
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok) return null;

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html")) return null;

    const html = await response.text();
    const text = extractMainText(html);
    if (text.length < 250) return null;

    return text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
