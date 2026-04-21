import { runResearchAgent } from '../src/agent/researchAgent.js';

/**
 * Vercel Serverless Function — replaces the Express /api/research route.
 * Environment variables (GEMINI_API_KEY, GEMINI_MODEL) must be set
 * in the Vercel project dashboard → Settings → Environment Variables.
 */
export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const { topic } = req.body || {};

  if (typeof topic !== 'string' || topic.trim().length < 3) {
    return res.status(400).json({
      ok: false,
      error: 'Please provide a topic with at least 3 characters.'
    });
  }

  try {
    const data = await runResearchAgent(topic.trim());
    return res.json({ ok: true, data });
  } catch (error) {
    console.error('[api/research] error:', error?.message || error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Something went wrong while researching the topic.'
    });
  }
}
