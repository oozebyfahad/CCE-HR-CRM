import { useState, useEffect } from 'react'
import { fetchRotaAttendance, type RotaAttendance } from '../services/rotacloud'
import type { FirebaseEmployee } from './useFirebaseEmployees'

// ── Output shapes ─────────────────────────────────────────────────────

export interface DailyAttendanceRow {
  employeeId:      string
  employeeName:    string
  department:      string
  clockIn?:        string   // 'HH:MM' 24h
  clockOut?:       string   // 'HH:MM' 24h
  hoursWorked:     number
  overtime:        number
  isClockedIn:     boolean
  minutesLate:     number
  status:          'clocked_in' | 'present' | 'absent' | 'late' | 'half_day' | 'not_clocked_in'
  statusSource:    'rotacloud' | 'no_data'
  rotacloudLinked: boolean
}

export interface WeeklyChartRow {
  day:     string
  present: number
  absent:  number
  late:    number
}

// ── Helpers ───────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}

export function unixToLocalDate(unix: number): string {
  const d = new Date(unix * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function unixToHHMM(unix: number | null | undefined): string | undefined {
  if (!unix) return undefined
  const d = new Date(unix * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function deriveStatus(
  rec: RotaAttendance | undefined,
  isToday: boolean,
): { status: DailyAttendanceRow['status']; statusSource: DailyAttendanceRow['statusSource'] } {
  if (!rec) {
    return { status: isToday ? 'not_clocked_in' : 'absent', statusSource: 'no_data' }
  }
  // Clocked in but hasn't left yet
  if (rec.in_time_clocked && !rec.out_time_clocked) {
    return { status: 'clocked_in', statusSource: 'rotacloud' }
  }
  if (rec.hours > 0) {
    if (rec.hours < 4)          return { status: 'half_day', statusSource: 'rotacloud' }
    if (rec.minutes_late > 30)  return { status: 'late',     statusSource: 'rotacloud' }
    return                             { status: 'present',   statusSource: 'rotacloud' }
  }
  return { status: 'not_clocked_in', statusSource: 'rotacloud' }
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useRotaAttendance(date: string, employees: FirebaseEmployee[]) {
  const [records, setRecords] = useState<RotaAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const today     = new Date().toISOString().slice(0, 10)
  const weekStart = addDays(date, -6)

  useEffect(() => {
    if (!date) return
    let cancelled = false
    setLoading(true)
    setError('')

    const startUnix = Math.floor(new Date(weekStart + 'T00:00:00').getTime() / 1000)
    const endUnix   = Math.floor(new Date(date    + 'T23:59:59').getTime() / 1000)

    fetchRotaAttendance(startUnix, endUnix)
      .then(recs => {
        if (!cancelled) {
          setRecords(recs.filter(r => !r.deleted))
          setLoading(false)
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [date]) // weekStart derives from date

  // Index records by (rotacloudId:date) — prefer approved record if duplicates
  const recMap = new Map<string, RotaAttendance>()
  for (const r of records) {
    const dateStr = unixToLocalDate(r.in_time)
    const key = `${r.user}:${dateStr}`
    const existing = recMap.get(key)
    if (!existing || r.approved) recMap.set(key, r)
  }

  const activeEmployees = employees.filter(e => e.status === 'active')
  const isToday = date === today

  // ── Rows for the selected date ────────────────────────────────────
  const rows: DailyAttendanceRow[] = activeEmployees.map(emp => {
    const linked = !!emp.rotacloudId
    const rec    = linked ? recMap.get(`${emp.rotacloudId}:${date}`) : undefined
    const { status, statusSource } = deriveStatus(rec, isToday)

    return {
      employeeId:      emp.id,
      employeeName:    emp.name,
      department:      emp.department ?? '',
      clockIn:         unixToHHMM(rec?.in_time_clocked),
      clockOut:        status === 'clocked_in' ? undefined : unixToHHMM(rec?.out_time_clocked),
      hoursWorked:     rec?.hours ?? 0,
      overtime:        Math.max(0, (rec?.hours ?? 0) - 8),
      minutesLate:     rec?.minutes_late ?? 0,
      isClockedIn:     status === 'clocked_in',
      status,
      statusSource,
      rotacloudLinked: linked,
    }
  })

  // ── Weekly bar chart ──────────────────────────────────────────────
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weeklyData: WeeklyChartRow[] = weekDays.map(d => {
    let present = 0, absent = 0, late = 0
    activeEmployees.forEach(emp => {
      const rec = emp.rotacloudId ? recMap.get(`${emp.rotacloudId}:${d}`) : undefined
      const { status } = deriveStatus(rec, d === today)
      if (['present', 'clocked_in', 'half_day'].includes(status)) present++
      else if (status === 'absent') absent++
      else if (status === 'late')   late++
    })
    return { day: shortDay(d), present, absent, late }
  })

  // ── Summary counts ────────────────────────────────────────────────
  const counts = {
    clocked_in:     rows.filter(r => r.status === 'clocked_in').length,
    present:        rows.filter(r => ['present', 'clocked_in', 'half_day'].includes(r.status)).length,
    absent:         rows.filter(r => r.status === 'absent').length,
    late:           rows.filter(r => r.status === 'late').length,
    not_clocked_in: rows.filter(r => r.status === 'not_clocked_in').length,
  }

  return { rows, weeklyData, counts, loading, error }
}
