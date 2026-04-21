const SYSTEM_PROMPT = `You are a highly capable research explainer agent.
Your task is to produce a structured JSON explanation of the EXACT topic the user provides.

Return ONLY a raw JSON object — no markdown fences, no explanation, no extra text. Just the JSON.

The JSON must follow this exact shape:
{
  "definition": "string",
  "simplified_insight": "string",
  "key_points": ["string"],
  "main_contents": [{"heading": "string", "details": "string"}],
  "sources_used": ["S1", "S2"]
}

STRICT Rules:
- "definition": Write a clear, accurate, encyclopedic definition of the user's EXACT topic. This MUST directly answer "What is [topic]?" with precision. If the topic is "AI agent", define what an AI agent is — nothing else.
- "simplified_insight": Explain the user's EXACT topic in plain everyday language that a curious 12-year-old can understand. Use analogies. This must be SPECIFICALLY about the given topic — not a generic description of this tool.
- "key_points": 5–7 key facts or takeaways specifically about the given topic.
- "main_contents": 3–5 meaningful subtopics that break down the given topic with clear headings and detailed explanations.
- "sources_used": List which source IDs (S1, S2, ...) you used.
- NEVER output generic filler like "This is a web-based research digest". ALWAYS write specifically about the topic.
- If the provided web sources are insufficient, use your own knowledge to write accurate content about the topic.`;

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function safeJsonParse(text) {
  if (!text) return null;
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function normalizeArray(values, maxItems = 6) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeMainContents(values) {
  if (!Array.isArray(values)) return [];

  return values
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const heading = typeof entry.heading === "string" ? entry.heading.trim() : "";
      const details = typeof entry.details === "string" ? entry.details.trim() : "";
      if (!heading || !details) return null;
      return { heading, details };
    })
    .filter(Boolean)
    .slice(0, 6);
}

// Smart fallback: builds topic-relevant content from the actual web snippets
function fallbackSummary({ topic, sources }) {
  const snippets = (sources || [])
    .map((s) => s.snippet)
    .filter(Boolean);

  // Build a definition from the best snippet available
  const bestSnippet = snippets[0] || "";
  const definition = bestSnippet
    ? `${topic}: ${bestSnippet}`
    : `${topic} is a subject with multiple dimensions. Explore the linked sources below for a comprehensive understanding.`;

  // Build simplified insight from second snippet or rephrase first
  const insightBase = snippets[1] || snippets[0] || "";
  const simplified_insight = insightBase
    ? `In simple terms — ${insightBase}`
    : `Think of "${topic}" as a concept that can be understood step by step. Check the sources below for beginner-friendly explanations.`;

  // Key points from remaining snippets
  const key_points = snippets.slice(0, 5).length
    ? snippets.slice(0, 5)
    : [`Open the sources below to learn more about "${topic}".`];

  // Main contents from source titles + snippets
  const main_contents = (sources || []).slice(0, 4).map((s) => ({
    heading: s.title || topic,
    details: s.snippet || `See full article at: ${s.url}`
  }));

  return {
    definition,
    simplified_insight,
    key_points,
    main_contents: main_contents.length
      ? main_contents
      : [{ heading: "Overview", details: `Try a more specific search about "${topic}".` }],
    sources_used: (sources || []).map((_, i) => `S${i + 1}`).slice(0, 6)
  };
}

function buildUserPrompt({ topic, documents }) {
  const sourceBlock = documents
    .map(
      (doc, index) =>
        `S${index + 1}\nTitle: ${doc.title}\nURL: ${doc.url}\nSnippet: ${doc.snippet || "N/A"}\nContent Extract:\n${doc.content}`
    )
    .join("\n\n");

  return `User's Exact Topic: "${topic}"

Research Sources:
${sourceBlock}

Task: Write a structured JSON explanation SPECIFICALLY about "${topic}".
- The "definition" must be a direct, accurate answer to "What is ${topic}?"
- The "simplified_insight" must explain "${topic}" simply, like you're talking to a beginner.
- Do NOT output generic text. Every field must be about "${topic}" specifically.`;
}

async function runGeminiSummarizer({ apiKey, model, prompt }) {
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.1
        // NOTE: responseMimeType intentionally omitted — it causes empty responses with some models
      }
    })
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Gemini API failed (${response.status}): ${reason.slice(0, 300)}`);
  }

  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log("[Gemini] Raw output length:", text?.length || 0);
  console.log("[Gemini] Raw output preview:", text?.slice(0, 200));

  return text || "";
}

export async function summarizeResearch(payload) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn("[summarize] No GEMINI_API_KEY found — using smart fallback.");
    return fallbackSummary(payload);
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = buildUserPrompt(payload);

  try {
    const outputText = await runGeminiSummarizer({ apiKey, model, prompt });

    if (!outputText || !outputText.trim()) {
      console.warn("[summarize] Gemini returned empty text — using smart fallback.");
      return fallbackSummary(payload);
    }

    const parsed = safeJsonParse(outputText);

    if (!parsed) {
      console.warn("[summarize] JSON parse failed — raw output was:", outputText.slice(0, 300));
      return fallbackSummary(payload);
    }

    const fallback = fallbackSummary(payload);

    return {
      definition:
        typeof parsed.definition === "string" && parsed.definition.trim().length > 10
          ? parsed.definition.trim()
          : fallback.definition,
      simplified_insight:
        typeof parsed.simplified_insight === "string" && parsed.simplified_insight.trim().length > 10
          ? parsed.simplified_insight.trim()
          : fallback.simplified_insight,
      key_points: normalizeArray(parsed.key_points, 7).length
        ? normalizeArray(parsed.key_points, 7)
        : fallback.key_points,
      main_contents: normalizeMainContents(parsed.main_contents).length
        ? normalizeMainContents(parsed.main_contents)
        : fallback.main_contents,
      sources_used: normalizeArray(parsed.sources_used, 8)
    };
  } catch (error) {
    console.error("[summarize] Gemini call threw:", error?.message || error);
    return fallbackSummary(payload);
  }
}
