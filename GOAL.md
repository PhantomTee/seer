# ArcPredict Goal

This repository is being built from the full `/goal` document supplied in the Codex thread on 2026-05-18:

ArcPredict is a production-quality, multi-page confidential prediction market application on Arc Testnet, Chain ID `5042002`, using USDC collateral, LI.FI and CCTP V2 funding, Fairblock Stabletrust confidential transfers, Chainlink and optimistic resolution, Supabase persistence, and a Claude `claude-sonnet-4-20250514` agent.

The implementation preserves the goal's required structure and modules in code:

- Arc constants and contract addresses in `constants/arc.ts`
- One-time wallet/env bootstrap in `scripts/setup.ts`
- Foundry contracts in `contracts/`
- Next.js App Router pages in `app/`
- UI components in `components/`
- Hooks in `hooks/`
- Integration libraries in `lib/`
- Supabase migrations and Edge Functions in `supabase/`

Do not treat this file as a replacement for the supplied build specification; it records the active objective for the workspace.
