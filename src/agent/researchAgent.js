import { fetchPageContent } from "./fetchContent.js";
import { searchWeb } from "./search.js";
import { summarizeResearch } from "./summarize.js";

const MAX_RESULTS = 6;

export async function runResearchAgent(topic) {
  const cleanTopic = String(topic || "").trim();
  if (!cleanTopic) {
    throw new Error("Topic is required.");
  }

  const sources = await searchWeb(cleanTopic, MAX_RESULTS);

  const contentList = await Promise.all(
    sources.map(async (source) => {
      const content = await fetchPageContent(source.url);
      return {
        ...source,
        content: content || source.snippet || ""
      };
    })
  );

  const validDocuments = contentList
    .filter((item) => item.content && item.content.length >= 80)
    .slice(0, MAX_RESULTS);

  if (!validDocuments.length) {
    throw new Error(
      "I found results, but could not extract enough readable content. Try a more specific topic."
    );
  }

  const summary = await summarizeResearch({
    topic: cleanTopic,
    documents: validDocuments,
    sources
  });

  return {
    topic: cleanTopic,
    ...summary,
    sources: sources.map((source, index) => ({
      id: `S${index + 1}`,
      title: source.title,
      url: source.url,
      snippet: source.snippet
    })),
    generated_at: new Date().toISOString()
  };
}
