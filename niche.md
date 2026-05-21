# Niche Spec

This file is injected into the scoring prompt. Haiku rates each fetched item 0–10
on how well it matches the angle and topics below, and returns a one-line reason.
Edit freely — this is the single lever that controls relevance.

---

## 1. Who I am / my angle

I'm an **AI Workflow Architect**. I teach developers how to build with AI coding
agents — Claude Code, Cursor, agent SDKs, MCP — and how to design AI-assisted
development workflows that actually ship. My content is practical, hands-on, and
aimed at working engineers who want to get more leverage out of AI tooling.

I care about *how the work gets done* — concrete techniques, real results, new
capabilities I can put to use — not hype, punditry, or business drama.

---

## 2. Strong-yes topics  (score 8–10)

- New or updated **AI coding agents** and their capabilities (Claude Code, Cursor,
  Codex, Cline, Aider, Windsurf, etc.)
- **Claude / Anthropic** releases, features, model updates, and SDK changes
- **MCP** (Model Context Protocol) — servers, clients, patterns, integrations
- **Agent SDKs / agent frameworks** and how to build with them
- **Context engineering & prompting techniques** with demonstrable results
- **AI-assisted dev workflows** — orchestration, multi-agent setups, eval loops,
  CI integration, spec-driven development
- Concrete **developer-productivity results / case studies** ("we shipped X with
  agents in Y time")
- Hands-on **tutorials, deep dives, teardowns** of agent tooling

## 3. Medium / depends  (score 4–7)

- General LLM model releases (GPT, Gemini, Llama) — relevant only insofar as they
  affect coding workflows
- Broader dev-tooling news (IDEs, terminals, languages) with an AI angle
- Research papers (arXiv) on agents/coding — interesting but often not content-ready

## 4. Hard-no topics  (score 0–2)

- Crypto / web3 / blockchain
- Generic "AI will change everything" punditry and thought-leadership with no substance
- Image / video / music generation (not my lane)
- Funding rounds, valuations, exec hires, corporate drama
- Consumer chatbot news with no developer relevance
- AI ethics / policy / regulation debates
- Listicles ("10 AI tools you must try")

---

## 5. Scoring guidance

- Reward **specificity and actionability**: can I make a tutorial/post out of this?
- Reward **novelty**: is this a genuinely new capability or just a rehash?
- Penalize **hype without substance**.
- A perfect 10 = a new agent capability or technique I can demo and teach this week.
- Always return: `{ "score": <0-10 int>, "reason": "<one short sentence>" }`

<!-- TODO(dan): tighten the strong-yes list with the specific tools/people you track,
     and add any pet topics or recurring series you want to feed. -->
