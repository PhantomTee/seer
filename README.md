# ArcPredict

ArcPredict is a USDC-native prediction market application for Arc Testnet. It includes Foundry contracts, a Next.js 15 App Router frontend, Supabase persistence and realtime flows, LI.FI/CCTP bridging helpers, Fairblock Stabletrust confidential position flows, and an Anthropic Claude-powered market agent.

## Quickstart

```bash
pnpm install
pnpm setup
```

After `pnpm setup`, fund the generated `DEPLOYER_ADDRESS` and `AGENT_ADDRESS` at the Circle faucet, fill the remaining empty values in `.env.local`, then run:

```bash
pnpm contracts:install
pnpm contracts:build
pnpm contracts:test
pnpm contracts:deploy
supabase db push
supabase functions deploy resolve-markets
supabase functions deploy monitor-disputes
supabase functions deploy suggest-markets
pnpm dev
```

Arc constants are generated from the official Arc Testnet documentation fetched on 2026-05-18. Arc USDC uses 18 decimals for native gas accounting and 6 decimals through the ERC-20 interface; all collateral code uses the ERC-20 interface.
