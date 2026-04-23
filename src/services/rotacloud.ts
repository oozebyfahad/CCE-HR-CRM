// RotaCloud API service — all calls go via the Netlify proxy function.
// The API key never reaches the browser.

const PROXY = '/api/rotacloud'

async function rotaCall<T>(
  path: string,
  params?: Record<string, string | number>,
  paginate = false,
): Promise<T> {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, params, paginate }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `RotaCloud error ${res.status}`)
  return json.data as T
}

// ── Types ─────────────────────────────────────────────────────────────

export interface RotaUser {
  id: number
  first_name: string
  last_name: string
  preferred_name?: string | null
  email: string
  phone?: string | null
  dob?: string | null
  start_date?: string | null
  gender?: string | null
  salary_type?: string | null       // 'hourly' | 'salaried'
  employment_type?: string | null
  locations: number[]
  roles: number[]
  default_role?: number | null
  address_1?: string | null
  city?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relationship?: string | null
  deleted: boolean
}

export interface RotaAttendance {
  id: number
  user: number                      // RotaCloud user ID
  location: number                  // project/client location ID
  role: number                      // job role ID
  in_time: number                   // scheduled in (Unix s)
  out_time: number                  // scheduled out (Unix s)
  in_time_clocked?: number | null   // actual clock-in (Unix s)
  out_time_clocked?: number | null  // actual clock-out (Unix s)
  minutes_break: number
  minutes_late: number
  hours: number                     // approved hours for this attendance record
  approved: boolean
  deleted: boolean
  in_method: string                 // 'terminal' | 'timesheet' | 'manual'
  out_method: string
}

export interface RotaShift {
  id: number
  user: number
  location: number
  role: number
  start_time: number   // Unix s
  end_time: number     // Unix s
  minutes_break: number
  published: boolean
  open: boolean        // unassigned open shift
  deleted: boolean
}

export interface RotaLocation {
  id: number
  name: string
  users: number[]
  managers: number[]
}

export interface RotaRole {
  id: number
  name: string
  users: number[]
  colour?: string | null
}

// ── API calls ─────────────────────────────────────────────────────────

export const fetchRotaUsers = () =>
  rotaCall<RotaUser[]>('users', { limit: 500 })

export const fetchRotaAttendance = (startUnix: number, endUnix: number, userId?: number) =>
  rotaCall<RotaAttendance[]>('attendance',
    userId ? { start: startUnix, end: endUnix, user_id: userId } : { start: startUnix, end: endUnix },
    true)

export const fetchRotaShifts = (startUnix: number, endUnix: number, userId?: number) =>
  rotaCall<RotaShift[]>('shifts',
    userId ? { start: startUnix, end: endUnix, user_id: userId } : { start: startUnix, end: endUnix },
    true)

export const fetchRotaLocations = () =>
  rotaCall<RotaLocation[]>('locations')

export const fetchRotaRoles = () =>
  rotaCall<RotaRole[]>('roles')

// ── Helpers ───────────────────────────────────────────────────────────

export function rotaUserName(u: RotaUser): string {
  const raw = u.preferred_name || `${u.first_name} ${u.last_name}`
  // RotaCloud sometimes stores nicknames in parentheses at the start e.g. "(Aidan) Azam"
  return raw.replace(/^\([^)]*\)\s*/, '').trim()
}

/** Returns start/end Unix timestamps (seconds) for a given month string 'YYYY-MM' */
export function monthToUnix(month: string): { start: number; end: number } {
  const [y, m] = month.split('-').map(Number)
  const start = Math.floor(new Date(y, m - 1, 1, 0, 0, 0).getTime() / 1000)
  const end   = Math.floor(new Date(y, m, 0, 23, 59, 59).getTime() / 1000)
  return { start, end }
}

/** Sums approved hours per RotaCloud user ID from a set of attendance records */
export function sumHoursByUser(records: RotaAttendance[]): Record<number, number> {
  const map: Record<number, number> = {}
  for (const r of records) {
    if (!r.deleted && r.approved) {
      map[r.user] = (map[r.user] ?? 0) + r.hours
    }
  }
  return map
}
