// Netlify serverless function — proxies requests to RotaCloud API.
// The API key lives only here as a Netlify environment variable (ROTACLOUD_API_KEY).
// The browser never sees the key.

const BASE = 'https://api.rotacloud.com/v1'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const API_KEY = process.env.ROTACLOUD_API_KEY
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ROTACLOUD_API_KEY is not set in Netlify environment variables.' }),
    }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { path, params = {}, paginate = false } = body

  if (!path || typeof path !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing "path" field' }) }
  }

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Accept: 'application/json',
  }

  try {
    if (!paginate) {
      // Single request
      const url = new URL(`${BASE}/${path}`)
      Object.entries(params).forEach(([k, v]) => {
        if (v != null) url.searchParams.set(k, String(v))
      })

      const res = await fetch(url.toString(), { headers })
      const total = res.headers.get('X-Pagination-Total')
      const data = await res.json()

      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, total: total ? parseInt(total) : null }),
      }
    }

    // Auto-paginate — collects all pages server-side to avoid many round trips from the browser
    const LIMIT = 200
    const all = []
    let offset = 0
    let total = null

    do {
      const url = new URL(`${BASE}/${path}`)
      const pageParams = { ...params, limit: LIMIT, offset }
      Object.entries(pageParams).forEach(([k, v]) => {
        if (v != null) url.searchParams.set(k, String(v))
      })

      const res = await fetch(url.toString(), { headers })

      if (!res.ok) {
        const text = await res.text()
        return { statusCode: res.status, body: JSON.stringify({ error: text }) }
      }

      if (total === null) {
        const t = res.headers.get('X-Pagination-Total')
        total = t ? parseInt(t) : null
      }

      const page = await res.json()
      if (!Array.isArray(page) || page.length === 0) break
      all.push(...page)
      offset += LIMIT

      // Safety cap — never fetch more than 5000 records in one call
      if (all.length >= 5000) break
    } while (total !== null && all.length < total)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: all, total: all.length }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    }
  }
}
