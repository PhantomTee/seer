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
  const apiKey = process.env.GROQ_API_KEY
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
        content: `You are Arc Predict's on-chain analyst — an expert in crypto markets, DeFi protocols, macroeconomics, and prediction market pricing.

Arc Predict is a decentralized prediction market built on Arc Testnet (Circle's EVM chain). Markets resolve YES or NO based on real-world outcomes. Traders stake USDC on outcomes.

YOUR JOB: Give traders actionable probability estimates. Every question has a real probability — never refuse, never say "0% because criteria are unclear." If a question is broad, use your best judgment to assign a meaningful probability based on base rates, market conditions, and historical patterns.

RULES:
- Always give a specific probability (e.g. 35%, 72%) — never a range, never "uncertain"
- If resolution criteria are vague, interpret them charitably and state your interpretation
- Draw on real data: BTC/ETH price history, on-chain metrics, Fed policy, macro cycles, protocol TVL, developer activity
- Reference concrete numbers and dates where possible
- No disclaimers, no "I cannot provide financial advice", no "this is just my opinion"
- Write like a sharp analyst briefing a trader, not a chatbot covering its liability`,
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
          content: `You generate prediction market questions for Arc Predict — a DeFi prediction market on Arc Testnet where traders stake USDC on real-world outcomes.

Markets must be: specific, time-bound, objectively resolvable YES or NO, and interesting to crypto/DeFi traders.

You must respond ONLY with a valid JSON array — no preamble, no markdown fences, no backticks, no explanation.
Each element has exactly these fields: question (string), resolution_criteria (string), oracle_type ("CHAINLINK" or "OPTIMISTIC"), resolution_days (integer 1–365), rationale (string).

oracle_type rules: use "CHAINLINK" only for price-based questions (BTC > $X, ETH > $Y). Use "OPTIMISTIC" for everything else.`,
        },
        {
          role: 'user',
          content: `Generate exactly 5 high-quality yes/no prediction market questions. Mix across these categories:
- BTC or ETH price milestones (e.g. "Will BTC close above $120k before end of Q3 2026?")
- DeFi protocol metrics (e.g. "Will Uniswap v4 TVL exceed $5B within 90 days of launch?")
- Macro / Fed policy (e.g. "Will the Fed cut rates at least once before September 2026?")
- Layer 2 / chain adoption (e.g. "Will Base surpass Arbitrum in monthly active addresses by Aug 2026?")
- Stablecoin / regulatory events (e.g. "Will the US stablecoin bill pass both chambers before 2027?")

Each question must:
- Name specific numbers, dates, or thresholds
- Have clear, unambiguous resolution criteria that a neutral observer can verify
- Be resolvable within 14–365 days

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
