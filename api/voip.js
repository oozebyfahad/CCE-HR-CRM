/**
 * VIP VoIP UK — secure proxy (Vercel)
 *
 * GET /api/voip?id=ID          → stream/play recording (token injected server-side)
 * GET /api/voip?id=ID&dl=1     → download recording
 * POST /api/voip { action:'list', from:'YYYY-MM-DD', to:'YYYY-MM-DD' }
 *   → fetch recording list from VoIP server for the given date range
 *
 * Vercel env: VOIP_API_TOKEN
 */

const BASE = 'https://voipserver5216.vipvoipuk.net/api'

export default async function handler(req, res) {
  const TOKEN = process.env.VOIP_API_TOKEN
  if (!TOKEN) {
    return res.status(500).json({ error: 'VOIP_API_TOKEN not configured' })
  }

  // ── POST: fetch recording list by date range ──────────────────────────
  if (req.method === 'POST') {
    const { action, from, to } = req.body ?? {}

    if (action !== 'list') {
      return res.status(400).json({ error: 'Unknown action' })
    }

    // Try the most likely list endpoint — POST with form-encoded body
    // (same pattern as callRecordingWebHooksV1.php which uses --data)
    const endpoints = [
      'callRecordingGetListV1.php',
      'callRecordingsGetV1.php',
      'callRecordingListV1.php',
    ]

    for (const ep of endpoints) {
      try {
        const body = new URLSearchParams({ token: TOKEN })
        if (from) body.append('from', from)
        if (to)   body.append('to',   to)

        const r = await fetch(`${BASE}/${ep}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    body.toString(),
        })

        const text = await r.text()
        // Try to parse as JSON
        try {
          const data = JSON.parse(text)
          // If it's an array or has a recordings key, we found the right endpoint
          if (Array.isArray(data) || (data && typeof data === 'object')) {
            return res.json({ ok: true, endpoint: ep, data: Array.isArray(data) ? data : (data.recordings ?? data.data ?? [data]) })
          }
        } catch {
          // Not JSON — not the right endpoint, try next
        }
      } catch {
        // Network error on this endpoint, try next
      }
    }

    // None of the endpoints worked — return empty so UI shows "no results"
    return res.json({ ok: false, data: [], message: 'List endpoint not found on VoIP server — recordings only available via webhook' })
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
