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

      // Helper: parse and return CSV response
      function parseCsv(text) {
        const lines = text.trim().split('\n').filter(Boolean)
        if (lines.length < 2) return { ok: true, data: [], message: 'No recordings in this date range' }
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
        return { ok: true, data }
      }

      if (!from && !to) {
        // No dates — try token-only first (may return all recordings)
        try {
          const r = await fetch(`${BASE}/callRecordingListV1.php`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams({ token: TOKEN }).toString(),
          })
          const text = await r.text()
          if (r.status === 200) return res.json(parseCsv(text))
        } catch {}
        return res.json({ ok: false, data: [], message: 'SELECT_DATES' })
      }

      // Build all format + param-name combinations to try
      const attempts = []
      const fmts = [
        from,
        `${from} 00:00:00`,
        from.split('-').reverse().join('/'),
        from.split('-').reverse().join('-'),
        from.replace(/-/g, '/'),
        String(Math.floor(new Date(from).getTime() / 1000)),
      ]
      const tFmts = [
        to,
        `${to} 23:59:59`,
        to.split('-').reverse().join('/'),
        to.split('-').reverse().join('-'),
        to.replace(/-/g, '/'),
        String(Math.floor(new Date(`${to}T23:59:59`).getTime() / 1000)),
      ]
      const paramNames = [
        ['startDate', 'endDate'],
        ['start_date', 'end_date'],
        ['dateFrom', 'dateTo'],
        ['from', 'to'],
        ['fromDate', 'toDate'],
      ]

      for (const [sKey, eKey] of paramNames) {
        for (let i = 0; i < fmts.length; i++) {
          try {
            const r = await fetch(`${BASE}/callRecordingListV1.php`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body:    new URLSearchParams({ token: TOKEN, [sKey]: fmts[i], [eKey]: tFmts[i] }).toString(),
            })
            const text = await r.text()
            attempts.push({ sKey, eKey, fmt: fmts[i], status: r.status, preview: text.slice(0, 80) })
            if (r.status === 200) return res.json(parseCsv(text))
          } catch (err) {
            attempts.push({ sKey, eKey, fmt: fmts[i], error: String(err) })
          }
        }
      }

      return res.json({ ok: false, data: [], attempts })
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
