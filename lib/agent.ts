import type { MarketSuggestion } from '@/types/agent'

// ---------------------------------------------------------------------------
// Groq client — OpenAI-compatible API, free tier with rate limits.
// llama-3.3-70b-versatile: 131k context · 280 tok/s · best quality/speed ratio
// ---------------------------------------------------------------------------

const GROQ_BASE = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

interface OAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OAIResponse {
  choices: { message: { content: string } }[]
  error?: { message: string; type?: string }
}

async function chatComplete(messages: OAIMessage[], maxTokens = 1024): Promise<string> {
  // Strip UTF-8 BOM (0xFEFF) that PowerShell can inject when piping to stdin
  const apiKey = process.env.GROQ_API_KEY?.replace(/^﻿/, '').trim()
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured')
  }

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      temperature: 0.3,
      messages,
    }),
  })

  const data = (await res.json()) as OAIResponse
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Groq error ${res.status}`)
  }

  return (data.choices[0]?.message?.content ?? '').trim()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getMarketContext(question: string, resolutionCriteria: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    return [
      'Agent is not configured. Add GROQ_API_KEY to .env.local to enable market analysis.',
      '',
      `Question: ${question}`,
      `Resolution criteria: ${resolutionCriteria || 'Not provided'}`,
    ].join('\n')
  }

  return chatComplete(
    [
      {
        role: 'system',
        content: `You are SEER's prediction market analyst — an expert in forecasting outcomes across any domain: politics, sports, crypto, science, entertainment, geopolitics, economics, and more.

SEER is a decentralized prediction market built on Arc Testnet (Circle's EVM chain). Markets resolve YES or NO based on real-world outcomes. Traders stake USDC on outcomes.

YOUR JOB: Give traders actionable probability estimates for any question — crypto prices, election outcomes, sports results, tech launches, scientific milestones, anything. Every question has a real probability — never refuse, never say "I can't assess this."

RULES:
- Always give a specific probability (e.g. 35%, 72%) — never a range, never "uncertain"
- If resolution criteria are vague, interpret them charitably and state your interpretation
- Draw on relevant data: polling, historical base rates, market odds, precedent, expert consensus, current events
- Reference concrete numbers, odds, or comparisons where possible
- No disclaimers, no hedging, no "this is not financial advice"
- Write like a sharp analyst briefing a trader — confident, data-driven, concise`,
      },
      {
        role: 'user',
        content: `Market question: "${question}"
Resolution criteria: "${resolutionCriteria || 'Not explicitly stated — use best judgment based on the question wording'}"

Analyze this and respond in this exact format:

**Probability: XX%**
[One sentence stating your estimate and the single strongest reason for it]

**Key factors**
1. [Factor with specific supporting data or number]
2. [Factor with specific supporting data or number]
3. [Factor with specific supporting data or number]

**Comparable events / base rates**
[2–3 sentences: what has happened historically in similar situations, relevant price levels or dates]

**What could flip this**
[1–2 sentences: the most likely scenario that would make you significantly revise the probability]`,
      },
    ],
    1024
  )
}

export async function generateMarketSuggestions(): Promise<MarketSuggestion[]> {
  if (!process.env.GROQ_API_KEY) return []

  let text = ''
  try {
    text = await chatComplete(
      [
        {
          role: 'system',
          content: `You generate prediction market questions for SEER — a decentralized prediction market on Arc Testnet where traders stake USDC on real-world outcomes.

Markets can be about ANYTHING: politics, sports, crypto, AI/tech, science, entertainment, geopolitics, economics, pop culture — whatever is genuinely interesting and resolvable.

You must respond ONLY with a valid JSON array — no preamble, no markdown fences, no backticks, no explanation.
Each element has exactly these fields: question (string), resolution_criteria (string), oracle_type ("CHAINLINK" or "OPTIMISTIC"), resolution_days (integer 1–365), rationale (string).

oracle_type rules: use "CHAINLINK" only for BTC/ETH price questions. Use "OPTIMISTIC" for everything else.`,
        },
        {
          role: 'user',
          content: `Generate exactly 5 high-quality yes/no prediction market questions. Pick a diverse mix — no more than 1 crypto price question. Spread across different domains such as:
- Politics / elections (e.g. "Will [candidate] win [election] before [date]?")
- Sports (e.g. "Will [team] win [tournament] in [year]?")
- AI / tech (e.g. "Will OpenAI release GPT-5 before [date]?")
- Crypto events — non-price (launches, ETF approvals, governance, hacks)
- Science / space (e.g. "Will SpaceX land Starship on the Moon before 2027?")
- Economics / macro (e.g. "Will the US enter a recession before Q1 2027?")
- Entertainment / pop culture (e.g. "Will [movie] gross over $1B worldwide?")

Each question must:
- Name specific people, teams, thresholds, or dates
- Have clear, unambiguous resolution criteria any neutral observer can verify
- Be genuinely interesting and debatable — not obvious

Return ONLY a JSON array with 5 elements — no extra text, no markdown.`,
        },
      ],
      2048
    )

    // Strip any accidental markdown fences
    const cleaned = text.replace(/```(?:json)?[\s\S]*?```/g, (m) => m.replace(/```(?:json)?/g, '')).trim()
    const match = /\[[\s\S]*\]/.exec(cleaned)
    if (!match) throw new Error('No JSON array found in response')
    return JSON.parse(match[0]) as MarketSuggestion[]
  } catch (err) {
    console.error('Failed to parse agent suggestions:', err, '\nRaw:', text)
    return []
  }
}

export async function evaluateChainlinkResolution(
  question: string,
  currentPrice: number,
  threshold: number,
  isAbove: boolean
): Promise<{ shouldResolve: boolean; outcome: 0 | 1; rationale: string }> {
  // Pure deterministic logic — no LLM call needed
  const outcome: 0 | 1 = isAbove ? (currentPrice > threshold ? 0 : 1) : currentPrice < threshold ? 0 : 1
  return {
    shouldResolve: true,
    outcome,
    rationale: `${question}: current price ${currentPrice} is ${isAbove ? 'above' : 'below'} threshold ${threshold}. Resolves ${outcome === 0 ? 'YES' : 'NO'}.`,
  }
}
