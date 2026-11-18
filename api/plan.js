// POST /api/plan — asks Claude for a project plan (or a repair of one) and streams the text back.
// The prompt is built here from the app's own curriculum, so this endpoint can only produce plans.
// Env: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (default claude-sonnet-5-5), PLAN_DAILY_LIMIT (default 10 requests per visitor per day)

require("../public/missions.js");
require("../public/build.js");
const { planPrompt, repairPrompt } = globalThis.Build;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const DAILY_LIMIT = Number(process.env.PLAN_DAILY_LIMIT || 10);

// Best-effort per-visitor limit. Serverless instances don't share memory, so for real traffic
// swap this for a shared store (for example Vercel KV or Upstash Redis).
const hits = new Map();
function allow(ip) {
  const day = new Date().toISOString().slice(0, 10);
  const key = ip + "|" + day;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (hits.size > 10000) hits.clear();
  return n <= DAILY_LIMIT;
}

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

function buildPrompt(body) {
  const idea = str(body && body.idea, 160).trim();
  if (!idea) return null;
  if (!body.plan) return planPrompt(idea);
  const steps = Array.isArray(body.plan.steps) ? body.plan.steps.slice(0, 60) : [];
  const plan = {
    name: str(body.plan.name, 40), summary: str(body.plan.summary, 200),
    steps: steps.map((s) => ({ unit: str(s.unit, 40), t: str(s.t, 40), d: str(s.d, 120), code: str(s.code, 1200), expectError: !!s.expectError }))
  };
  const problems = (Array.isArray(body.problems) ? body.problems : []).slice(0, 60)
    .map((p) => ({ i: Number(p.i) || 0, msg: str(p.msg, 400) }));
  return repairPrompt(idea, plan, problems);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Use POST."); }
  if (!process.env.ANTHROPIC_API_KEY) { res.statusCode = 503; return res.end("Planning is not configured."); }
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
  if (!allow(ip)) { res.statusCode = 429; return res.end("Daily limit reached. Try again tomorrow."); }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const prompt = buildPrompt(body || {});
  if (!prompt) { res.statusCode = 400; return res.end("Send { idea }."); }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, stream: true, messages: [{ role: "user", content: prompt }] })
  }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    res.statusCode = upstream && upstream.status === 429 ? 429 : 502;
    return res.end("The planning model is unavailable right now.");
  }

  res.statusCode = 200;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("cache-control", "no-store");

  // Relay only the text deltas from Anthropic's event stream
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        let ev;
        try { ev = JSON.parse(line.slice(5)); } catch { continue; }
        if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") res.write(ev.delta.text);
        if (ev.type === "error") res.write("\nERROR: " + ((ev.error && ev.error.message) || "model error"));
      }
    }
  } catch {
    res.write("\nERROR: connection to the model dropped");
  }
  res.end();
};

module.exports.buildPrompt = buildPrompt;
