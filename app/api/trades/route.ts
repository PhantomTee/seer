import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export async function POST(req: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  let body: {
    market_id: number
    wallet_address: string  // aliased → trader_address in DB
    outcome_index: number
    price: number
    amount: number          // USDC staked
    tx_hash: string
    order_type: string
    status: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { market_id, wallet_address, outcome_index, price, amount, tx_hash, order_type, status } = body

  if (!market_id || wallet_address === undefined || outcome_index === undefined || !tx_hash) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Deduplicate: if this tx_hash was already recorded, return the existing row
  const { data: existing } = await supabase
    .from('trades')
    .select('id')
    .eq('tx_hash', tx_hash)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id, duplicate: true })
  }

  // tokens received ≈ USDC staked / price per token
  const tokensReceived = price > 0 ? amount / price : amount

  // Insert trade — column names match the Trade type / DB schema
  const { data: trade, error: tradeError } = await supabase
    .from('trades')
    .insert({
      market_id,
      trader_address: wallet_address,
      outcome_index,
      side: 'BUY',
      amount_tokens: tokensReceived,
      usdc_amount: amount,
      price,
      tx_hash,
      trade_source: order_type === 'limit' ? 'ORDER_BOOK' : 'CPMM',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (tradeError) {
    return NextResponse.json({ error: tradeError.message }, { status: 500 })
  }

  // ---------------------------------------------------------------------------
  // Increment total_volume_usdc on the market row
  // ---------------------------------------------------------------------------
  await supabase.rpc('increment_market_volume', { p_market_id: market_id, p_amount: amount })
    .then(({ error }) => {
      if (error) {
        // Fallback: manual fetch-then-update if RPC doesn't exist yet
        return supabase
          .from('markets')
          .select('total_volume_usdc')
          .eq('id', market_id)
          .single()
          .then(({ data }) => {
            if (!data) return
            const newVol = Number(data.total_volume_usdc ?? 0) + amount
            return supabase.from('markets').update({ total_volume_usdc: newVol }).eq('id', market_id)
          })
      }
    })

  // ---------------------------------------------------------------------------
  // Upsert the positions table so portfolio reflects this trade immediately.
  // avg_price is a weighted average across all buys for this (market, wallet, outcome).
  // ---------------------------------------------------------------------------

  // Fetch existing position for this (market_id, wallet_address, outcome_index)
  const { data: existingPosition } = await supabase
    .from('positions')
    .select('id, token_amount, avg_price_usdc')
    .eq('market_id', market_id)
    .eq('user_address', wallet_address)
    .eq('outcome_index', outcome_index)
    .maybeSingle()

  if (existingPosition) {
    // Weighted average: (old_tokens * old_price + new_tokens * new_price) / total_tokens
    const oldTokens = Number(existingPosition.token_amount ?? 0)
    const oldAvg = Number(existingPosition.avg_price_usdc ?? price)
    const newTotalTokens = oldTokens + tokensReceived
    const newAvgPrice = newTotalTokens > 0
      ? (oldTokens * oldAvg + tokensReceived * price) / newTotalTokens
      : price

    await supabase
      .from('positions')
      .update({
        token_amount: newTotalTokens,
        avg_price_usdc: newAvgPrice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingPosition.id)
  } else {
    // First buy for this outcome — create a new position row
    await supabase
      .from('positions')
      .insert({
        market_id,
        user_address: wallet_address,
        outcome_index,
        token_amount: tokensReceived,
        avg_price_usdc: price,
        is_confidential: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
  }

  return NextResponse.json({ id: trade.id })
}
