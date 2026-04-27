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

    // Fetch historical recordings from callRecordingListV1.php (returns CSV)
    if (action === 'probe') {
      const { from, to } = req.body ?? {}

      // Try date formats until server accepts one
      const formats = [
        { startDate: from,                                      endDate: to                                     },
        { startDate: from ? `${from} 00:00:00` : '',           endDate: to ? `${to} 23:59:59` : ''             },
        { startDate: from ? from.split('-').reverse().join('-') : '', endDate: to ? to.split('-').reverse().join('-') : '' },
        { startDate: from ? from.split('-').reverse().join('/') : '', endDate: to ? to.split('-').reverse().join('/') : '' },
      ]

      for (const params of formats) {
        try {
          const body = new URLSearchParams({ token: TOKEN, ...params })
          const r = await fetch(`${BASE}/callRecordingListV1.php`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    body.toString(),
          })
          const text = await r.text()

          if (r.status !== 200) continue

          // Parse CSV — header row + data rows
          const lines = text.trim().split('\n').filter(Boolean)
          if (lines.length < 2) {
            // Header only — no recordings in range
            return res.json({ ok: true, data: [], message: 'No recordings found in this date range' })
          }

          const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
          const data = lines.slice(1).map(line => {
            const cols = line.split(',').map(c => c.trim())
            const row = {}
            headers.forEach((h, i) => { row[h] = cols[i] ?? '' })

            const dur = parseInt(row.duration ?? '0') || 0
            const id  = row.id ?? ''
            return {
              id,
              callID:      '',
              duration:    dur,
              durationFmt: `${String(Math.floor(dur / 60)).padStart(2, '0')}:${String(dur % 60).padStart(2, '0')}`,
              datetime:    row.datetime ?? '',
              source:      row.source ?? '',
              destination: row.destination ?? '',
              isProtected: false,
              filename:    row.filename ?? '',
              url:         `${BASE}/callRecordingGetV1.php?callRecordingId=${encodeURIComponent(id)}`,
            }
          })

          return res.json({ ok: true, data })
        } catch (err) {
          // try next format
          console.error('Format attempt failed:', err)
        }
      }
      return res.json({ ok: false, data: [], message: 'All date formats rejected by VoIP server' })
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
