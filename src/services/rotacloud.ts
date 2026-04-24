// RotaCloud API service — all calls go via the Netlify proxy function.
// The API key never reaches the browser.

const PROXY = '/api/rotacloud'

async function rotaWrite<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  data?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, method, data }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `RotaCloud error ${res.status}`)
  return json.data as T
}

async function rotaCall<T>(
  path: string,
  params?: Record<string, string | number>,
  paginate = false,
  emptyOn404 = false,
): Promise<T> {
  const res = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, params, paginate }),
  })
  const json = await res.json()
  if (!res.ok) {
    if (emptyOn404 && res.status === 404) return (Array.isArray([]) ? [] : null) as unknown as T
    throw new Error(json.error ?? `RotaCloud error ${res.status}`)
  }
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
  latitude?: number | null
  longitude?: number | null
  radius?: number | null   // geofence radius in metres
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

export const fetchRotaAttendance = (startUnix: number, endUnix: number) =>
  rotaCall<RotaAttendance[]>('attendance', { start: startUnix, end: endUnix }, true)

export const fetchRotaShifts = (startUnix: number, endUnix: number) =>
  rotaCall<RotaShift[]>('shifts', { start: startUnix, end: endUnix }, true)

export const fetchRotaLocations = () =>
  rotaCall<RotaLocation[]>('locations')

export const fetchRotaRoles = () =>
  rotaCall<RotaRole[]>('roles')

export const fetchRotaUser = (userId: number) =>
  rotaCall<RotaUser>(`users/${userId}`)

export const rotaClockIn = (
  userId: number,
  locationId: number,
  roleId: number,
  clockInUnix: number,
  scheduledStartUnix?: number,
) =>
  rotaWrite<RotaAttendance>('POST', 'attendance', {
    user:            userId,
    location:        locationId,
    role:            roleId,
    in_time:         scheduledStartUnix ?? clockInUnix,
    in_time_clocked: clockInUnix,
    in_method:       'terminal',
  })

export const rotaClockOut = (attendanceId: number, clockOutUnix: number) =>
  rotaWrite<RotaAttendance>('PATCH', `attendance/${attendanceId}`, {
    out_time_clocked: clockOutUnix,
    out_method:       'terminal',
  })

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

export interface RotaLeaveType {
  id: number
  name: string
  colour?: string | null
  allowance?: number | null   // annual days allowance (may be null/0 if not configured)
}

export interface RotaLeave {
  id: number
  user: number
  leave_type: number          // leave type ID — join with RotaLeaveType
  status: string              // 'approved' | 'pending' | 'declined' | 'cancelled'
  start_date: string          // YYYY-MM-DD
  end_date: string            // YYYY-MM-DD
  days: number
  notes?: string | null
  approved_by?: number | null
}

export const fetchRotaLeaveTypes = () =>
  rotaCall<RotaLeaveType[]>('leave-types', undefined, false, true)

export const fetchRotaLeave = (userId: number) =>
  rotaCall<RotaLeave[]>('leave', { user_id: userId }, true, true)

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
