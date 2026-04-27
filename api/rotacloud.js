// Vercel serverless function — proxies requests to RotaCloud API.
// The API key lives only here as a Vercel environment variable (ROTACLOUD_API_KEY).
// The browser never sees the key.

const BASE = 'https://api.rotacloud.com/v1'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Allow callers to pass a per-org API key; fall back to the Vercel env var
  const { path, params = {}, paginate = false, method = 'GET', data = null, apiKey } = req.body
  const API_KEY = apiKey || process.env.ROTACLOUD_API_KEY

  if (!API_KEY) {
    return res.status(500).json({ error: 'No RotaCloud API key available. Set ROTACLOUD_API_KEY in Vercel environment variables or pass apiKey in the request body.' })
  }

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'Missing "path" field' })
  }

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
  }

  try {
    // Non-GET requests (POST, PATCH, DELETE) — single call, no pagination
    if (method !== 'GET') {
      const url = new URL(`${BASE}/${path}`)
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) url.searchParams.set(k, String(v))
      })
      const apiRes = await fetch(url.toString(), {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: data != null ? JSON.stringify(data) : undefined,
      })
      const text = await apiRes.text()
      let resData
      try { resData = JSON.parse(text) } catch { resData = text }
      if (!apiRes.ok) return res.status(apiRes.status).json({ error: text })
      return res.status(apiRes.status).json({ data: resData })
    }

    if (!paginate) {
      const url = new URL(`${BASE}/${path}`)
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) url.searchParams.set(k, String(v))
      })

      const apiRes = await fetch(url.toString(), { headers })
      const total = apiRes.headers.get('X-Pagination-Total')
      const data = await apiRes.json()

      return res.status(apiRes.status).json({ data, total: total ? parseInt(total) : null })
    }

    // Auto-paginate — collects all pages server-side
    const LIMIT = 200
    const all = []
    let offset = 0
    let total = null

    while (true) {
      const url = new URL(`${BASE}/${path}`)
      const pageParams = { ...params, limit: LIMIT, offset }
      Object.entries(pageParams).forEach(([k, v]) => {
        if (v != null) url.searchParams.set(k, String(v))
      })

      const apiRes = await fetch(url.toString(), { headers })

      if (!apiRes.ok) {
        const text = await apiRes.text()
        return res.status(apiRes.status).json({ error: text })
      }

      if (total === null) {
        const t = apiRes.headers.get('X-Pagination-Total')
        total = t ? parseInt(t) : null
      }

      const page = await apiRes.json()
      if (!Array.isArray(page) || page.length === 0) break
      all.push(...page)
      offset += LIMIT

      if (all.length >= 5000) break

      // Stop when we know total and have reached it, or when last page was partial
      if (total !== null ? all.length >= total : page.length < LIMIT) break
    }

    return res.status(200).json({ data: all, total: all.length })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
