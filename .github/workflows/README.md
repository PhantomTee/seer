# GitHub Actions Cron Jobs

Three workflows replace Vercel Cron for agent automation:

| Workflow | Schedule | Endpoint |
|---|---|---|
| `cron-resolve.yml` | Every 5 min | `POST /api/agent/resolve` |
| `cron-monitor.yml` | Every 15 min | `POST /api/agent/monitor` |
| `cron-suggest.yml` | Daily 08:00 UTC | `POST /api/agent/suggest` |

## Required GitHub Secrets

Set these in **GitHub → repo → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `APP_URL` | Your deployed app URL e.g. `https://arcpredict.vercel.app` |
| `AGENT_CRON_SECRET` | Same value as `AGENT_CRON_SECRET` in your `.env.local` |

## Manual trigger

Each workflow has `workflow_dispatch` enabled — you can run any job manually from
**GitHub → Actions → (workflow name) → Run workflow**.
