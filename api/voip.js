/**
 * VIP VoIP UK — secure proxy (Vercel)
 *
 * GET  /api/voip?id=ID        → redirect to playback URL (token injected)
 * GET  /api/voip?id=ID&dl=1   → redirect to download URL
 * POST /api/voip { action:'check' }
 *   → verify token + list registered webhooks
 * POST /api/voip { action:'register', webhookUrl, customerToken }
 *   → register the webhook with the VoIP server
 *
 * Vercel env: VOIP_API_TOKEN
 */

const BASE = 'https://voipserver5216.vipvoipuk.net/api'

export default async function handler(req, res) {
  const TOKEN = process.env.VOIP_API_TOKEN
  if (!TOKEN) {
    return res.status(500).json({ error: 'VOIP_API_TOKEN not configured in Vercel env vars' })
  }

  // ── POST actions ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, webhookUrl, customerToken } = req.body ?? {}

    // Check token + list registered webhooks
    if (action === 'check') {
      try {
        const r = await fetch(`${BASE}/callRecordingWebHooksV1.php`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    new URLSearchParams({ token: TOKEN, cmd: 'get' }).toString(),
        })
        const text = await r.text()
        try {
          const data = JSON.parse(text)
          return res.json({ ok: true, webhooks: Array.isArray(data) ? data : [], raw: text })
        } catch {
          return res.json({ ok: false, webhooks: [], raw: text.slice(0, 300) })
        }
      } catch (err) {
        return res.status(500).json({ ok: false, error: String(err), webhooks: [] })
      }
    }

    // Register the webhook
    if (action === 'register') {
      if (!webhookUrl || !customerToken) {
        return res.status(400).json({ error: 'webhookUrl and customerToken required' })
      }
      try {
        const r = await fetch(`${BASE}/callRecordingWebHooksV1.php`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    new URLSearchParams({ token: TOKEN, cmd: 'add', url: webhookUrl, customerToken }).toString(),
        })
        const text = await r.text()
        return res.json({ ok: r.ok, raw: text })
      } catch (err) {
        return res.status(500).json({ ok: false, error: String(err) })
      }
    }

    return res.status(400).json({ error: 'Unknown action' })
  }

  // ── GET: play or download a single recording ──────────────────────────
  const { id, dl } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Missing id' })
  }

  const url = `${BASE}/callRecordingGetV1.php?callRecordingId=${encodeURIComponent(id)}&token=${TOKEN}`

  if (dl === '1') {
    res.setHeader('Content-Disposition', `attachment; filename="recording-${id}.mp4"`)
  }

  return res.redirect(307, url)
}
