/**
 * VIP VoIP UK — secure recording proxy (Vercel)
 *
 * Keeps VOIP_API_TOKEN server-side.  Never exposed to the browser.
 *
 * GET /api/voip?id=RECORDING_ID          → 307 to streaming playback URL
 * GET /api/voip?id=RECORDING_ID&dl=1     → 307 to download URL
 *
 * Set VOIP_API_TOKEN in Vercel environment variables.
 */

const BASE = 'https://voipserver5216.vipvoipuk.net/api'

export default async function handler(req, res) {
  const TOKEN = process.env.VOIP_API_TOKEN
  if (!TOKEN) {
    return res.status(500).json({ error: 'VOIP_API_TOKEN not configured in Vercel environment variables' })
  }

  const { id, dl } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Missing id parameter' })
  }

  const url = `${BASE}/callRecordingGetV1.php?callRecordingId=${encodeURIComponent(id)}&token=${TOKEN}`

  if (dl === '1') {
    res.setHeader('Content-Disposition', `attachment; filename="recording-${id}.mp4"`)
  }

  return res.redirect(307, url)
}
