import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { FirebaseEmployee } from './useFirebaseEmployees'
import type { TimeEntry, AttendanceRecord as HRAttendanceRecord } from './useFirebaseTimesheets'

// ── Output shape per employee per day ─────────────────────────────────
export interface DailyAttendanceRow {
  employeeId:  string
  employeeName: string
  department:  string
  clockIn?:    string   // earliest startTime today
  clockOut?:   string   // latest endTime today (if not still clocked in)
  hoursWorked: number
  overtime:    number
  isClockedIn: boolean
  status: 'clocked_in' | 'present' | 'absent' | 'late' | 'half_day' | 'not_clocked_in'
  statusSource: 'hr_marked' | 'time_entry' | 'no_data'
}

// ── Weekly bar chart row ───────────────────────────────────────────────
export interface WeeklyChartRow {
  day:     string
  present: number
  absent:  number
  late:    number
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}

// ─────────────────────────────────────────────────────────────────────
export function useFirebaseAttendance(date: string, employees: FirebaseEmployee[]) {
  const [todayEntries,  setTodayEntries]  = useState<TimeEntry[]>([])
  const [todayHR,       setTodayHR]       = useState<HRAttendanceRecord[]>([])
  const [weekEntries,   setWeekEntries]   = useState<TimeEntry[]>([])
  const [weekHR,        setWeekHR]        = useState<HRAttendanceRecord[]>([])
  const [loading,       setLoading]       = useState(true)

  const weekStart = addDays(date, -6)

  // Today: time_entries
  useEffect(() => {
    if (!date) return
    const q = query(collection(db, 'time_entries'), where('date', '==', date))
    return onSnapshot(q, snap => {
      setTodayEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry)))
      setLoading(false)
    }, () => setLoading(false))
  }, [date])

  // Today: attendance_records (HR-marked)
  useEffect(() => {
    if (!date) return
    const q = query(collection(db, 'attendance_records'), where('date', '==', date))
    return onSnapshot(q, snap => {
      setTodayHR(snap.docs.map(d => ({ id: d.id, ...d.data() } as HRAttendanceRecord)))
    })
  }, [date])

  // Week: time_entries (for chart)
  useEffect(() => {
    if (!date) return
    const q = query(
      collection(db, 'time_entries'),
      where('date', '>=', weekStart),
      where('date', '<=', date),
    )
    return onSnapshot(q, snap => {
      setWeekEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry)))
    })
  }, [date, weekStart])

  // Week: attendance_records (for chart — late/absent markings)
  useEffect(() => {
    if (!date) return
    const q = query(
      collection(db, 'attendance_records'),
      where('date', '>=', weekStart),
      where('date', '<=', date),
    )
    return onSnapshot(q, snap => {
      setWeekHR(snap.docs.map(d => ({ id: d.id, ...d.data() } as HRAttendanceRecord)))
    })
  }, [date, weekStart])

  // ── Compute per-employee rows for the selected day ─────────────────
  const activeEmployees = employees.filter(e => e.status === 'active')

  const rows: DailyAttendanceRow[] = activeEmployees.map(emp => {
    const empEntries    = todayEntries.filter(e => e.employeeId === emp.id)
    const hrRecord      = todayHR.find(a => a.employeeId === emp.id)
    const activeEntry   = empEntries.find(e => e.clockedIn)
    const doneEntries   = empEntries.filter(e => !e.clockedIn && e.hours > 0)

    const hoursWorked = doneEntries.reduce((s, e) => s + e.hours, 0)
    const overtime    = Math.max(0, hoursWorked - 8)

    // Earliest clock-in (all entries with a startTime, sorted asc)
    const withStart = empEntries.filter(e => e.startTime).sort((a, b) => a.startTime! < b.startTime! ? -1 : 1)
    const clockIn   = withStart[0]?.startTime ?? activeEntry?.startTime

    // Latest clock-out (completed entries with endTime, sorted desc)
    const withEnd  = doneEntries.filter(e => e.endTime).sort((a, b) => a.endTime! > b.endTime! ? -1 : 1)
    const clockOut = activeEntry ? undefined : withEnd[0]?.endTime

    // Status — HR marking takes priority over derived state
    let status: DailyAttendanceRow['status']
    let statusSource: DailyAttendanceRow['statusSource']

    if (hrRecord) {
      status       = hrRecord.status as DailyAttendanceRow['status']
      statusSource = 'hr_marked'
    } else if (activeEntry) {
      status       = 'clocked_in'
      statusSource = 'time_entry'
    } else if (empEntries.length > 0) {
      status       = 'present'
      statusSource = 'time_entry'
    } else {
      status       = 'not_clocked_in'
      statusSource = 'no_data'
    }

    return {
      employeeId:   emp.id,
      employeeName: emp.name,
      department:   emp.department,
      clockIn,
      clockOut,
      hoursWorked,
      overtime,
      isClockedIn:  !!activeEntry,
      status,
      statusSource,
    }
  })

  // ── Compute weekly bar chart (last 7 days) ─────────────────────────
  const weekDays: string[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const weeklyData: WeeklyChartRow[] = weekDays.map(d => {
    const empIdsWithEntries = new Set(weekEntries.filter(e => e.date === d).map(e => e.employeeId))
    const hrForDay          = weekHR.filter(a => a.date === d)
    const hrByEmp           = new Map(hrForDay.map(a => [a.employeeId, a.status]))

    let present = 0, absent = 0, late = 0
    activeEmployees.forEach(emp => {
      const hrStatus = hrByEmp.get(emp.id)
      if (hrStatus === 'absent') { absent++; return }
      if (hrStatus === 'late')   { late++;   return }
      if (hrStatus === 'present' || hrStatus === 'half_day' || empIdsWithEntries.has(emp.id)) { present++; return }
      // no data: don't count as absent — leave as unknown
    })

    return { day: shortDay(d), present, absent, late }
  })

  // ── Summary counts for today ───────────────────────────────────────
  const counts = {
    clocked_in:     rows.filter(r => r.status === 'clocked_in').length,
    present:        rows.filter(r => r.status === 'present' || r.status === 'clocked_in' || r.status === 'half_day').length,
    absent:         rows.filter(r => r.status === 'absent').length,
    late:           rows.filter(r => r.status === 'late').length,
    not_clocked_in: rows.filter(r => r.status === 'not_clocked_in').length,
  }

  return { rows, weeklyData, counts, loading }
}
