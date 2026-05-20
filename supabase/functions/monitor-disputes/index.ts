import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

serve(async (req) => {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== Deno.env.get('AGENT_CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL')!
  const res = await fetch(`${appUrl}/api/agent/monitor`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('AGENT_CRON_SECRET')}` }
  })
  return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } })
})
