import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runResearchAgent } from "./agent/researchAgent.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "..", "public");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDir));

app.get("/api/health", (_, res) => {
  res.json({ ok: true, status: "healthy" });
});

app.post("/api/research", async (req, res) => {
  const { topic } = req.body || {};

  if (typeof topic !== "string" || topic.trim().length < 3) {
    return res.status(400).json({
      ok: false,
      error: "Please provide a topic with at least 3 characters."
    });
  }

  try {
    const data = await runResearchAgent(topic);
    return res.json({ ok: true, data });
  } catch (error) {
    console.error("Research agent error:", error?.message || error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Something went wrong while researching the topic."
    });
  }
});

app.get("*", (_, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Research Agent web app is running on http://localhost:${PORT}`);
});
