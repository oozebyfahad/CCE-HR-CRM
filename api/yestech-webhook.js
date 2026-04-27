/**
 * Yestech VIP VoIP — Call Recording Webhook Receiver (Vercel)
 *
 * Vercel environment variables required:
 *   YESTECH_CUSTOMER_TOKEN   — the token you choose when registering this webhook
 *   FIREBASE_SERVICE_ACCOUNT — your Firebase service account JSON (minified, one line)
 *
 * Register with Yestech once (replace values from your Yestech portal):
 *   curl --data 'token=YOUR_ADMIN_TOKEN&url=https://YOUR-APP.vercel.app/api/yestech-webhook&customerToken=YOUR_CUSTOMER_TOKEN&cmd=add' \
 *     https://voipserverXXXX.vipvoipuk.net/api/callRecordingWebHooksV1.php
 */

import Busboy from 'busboy'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

// Disable Vercel's automatic body parser — we need raw stream for multipart
export const config = { api: { bodyParser: false } }

// ── Firebase Admin (init once per cold start) ─────────────────────────
function getDb() {
  if (!getApps().length) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT not set')
    initializeApp({ credential: cert(JSON.parse(sa)) })
  }
  return getFirestore()
}

// ── Parse multipart/form-data from Vercel req stream ─────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields = {}
    const bb = Busboy({ headers: req.headers })
    bb.on('field', (name, val) => { fields[name] = val })
    bb.on('file', (_name, stream) => { stream.resume() }) // drain file, don't store
    bb.on('finish', () => resolve(fields))
    bb.on('error', reject)
    req.pipe(bb)
  })
}

// ── Format seconds → MM:SS ────────────────────────────────────────────
function fmtDuration(secs) {
  const s = parseInt(secs) || 0
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── Handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  const CUSTOMER_TOKEN = process.env.YESTECH_CUSTOMER_TOKEN
  if (!CUSTOMER_TOKEN || !process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(500).send('Server misconfiguration — check Vercel environment variables')
  }

  let fields
  try {
    const ct = req.headers['content-type'] || ''

    if (ct.includes('multipart/form-data')) {
      fields = await parseMultipart(req)
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      // Collect body manually since bodyParser is off
      const raw = await new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => resolve(body))
        req.on('error', reject)
      })
      const p = new URLSearchParams(raw)
      fields = {}
      for (const [k, v] of p) fields[k] = v
    } else {
      // JSON fallback
      const raw = await new Promise((resolve, reject) => {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => resolve(body))
        req.on('error', reject)
      })
      fields = JSON.parse(raw || '{}')
    }
  } catch (err) {
    console.error('Body parse error:', err)
    return res.status(400).send('Bad Request')
  }

  // Validate token Yestech sends back
  if (fields.authenticationToken !== CUSTOMER_TOKEN) {
    console.warn('Invalid authenticationToken:', fields.authenticationToken)
    return res.status(401).send('Unauthorized')
  }

  if (fields.eventType !== 'callRecordingReady') {
    return res.status(200).send('Ignored')
  }

  const { id, callID, duration, datetime, source, destination, isProtected, filename, url } = fields

  if (!id) return res.status(400).send('Missing id')

  try {
    const db = getDb()
    await db.collection('call_recordings').doc(String(id)).set({
      id:          String(id),
      callID:      callID      || '',
      duration:    parseInt(duration) || 0,
      durationFmt: fmtDuration(duration),
      datetime:    datetime    || new Date().toISOString(),
      source:      source      || '',
      destination: destination || '',
      isProtected: isProtected === 'true' || isProtected === true,
      filename:    filename    || '',
      url:         url         || '',
      receivedAt:  FieldValue.serverTimestamp(),
    })

    console.log(`Saved: ${id} | ${source} → ${destination} | ${fmtDuration(duration)}`)
    return res.status(200).send('OK')
  } catch (err) {
    console.error('Firestore write failed:', err)
    return res.status(500).send('Internal Server Error')
  }
}
