import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export interface TimeEntry {
  id: string
  employeeId: string
  date: string          // 'YYYY-MM-DD'
  startTime?: string    // 'HH:MM' 24h
  endTime?: string      // 'HH:MM' 24h
  hours: number
  type: 'regular' | 'overtime' | 'holiday' | 'pto'
  projectTask?: string
  note?: string
  clockedIn?: boolean
}

export interface TimesheetApproval {
  id: string
  employeeId: string
  weekStart: string   // 'YYYY-MM-DD' Monday
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
}

// ── Utilities ─────────────────────────────────────────────────────────
export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60)
}

export function fmtHours(h: number): string {
  if (!h) return '0h 00m'
  const hrs  = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${hrs}h ${String(mins).padStart(2, '0')}m`
}

export function fmt12(t?: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap  = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function weekMonday(d: Date): Date {
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const dow  = day.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  day.setDate(day.getDate() + diff)
  return day
}

export const PROJECTS = [
  'Customer Service Operations',
  'Dispatch Coordination',
  'Driver Management',
  'Fleet Administration',
  'HR Administration',
  'IT Support',
  'General Administration',
]

// ── Single-employee hook ───────────────────────────────────────────────
export function useFirebaseTimesheets(employeeId: string) {
  const [entries,   setEntries]   = useState<TimeEntry[]>([])
  const [approvals, setApprovals] = useState<TimesheetApproval[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!employeeId) { setLoading(false); return }
    const q = query(collection(db, 'time_entries'), where('employeeId', '==', employeeId))
    return onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry))
      rows.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
      setEntries(rows)
      setLoading(false)
    }, () => setLoading(false))
  }, [employeeId])

  useEffect(() => {
    if (!employeeId) return
    const q = query(collection(db, 'timesheet_approvals'), where('employeeId', '==', employeeId))
    return onSnapshot(q, snap =>
      setApprovals(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimesheetApproval)))
    )
  }, [employeeId])

  const addEntry = async (data: Omit<TimeEntry, 'id'>) =>
    addDoc(collection(db, 'time_entries'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

  const updateEntry = async (id: string, data: Partial<TimeEntry>) =>
    updateDoc(doc(db, 'time_entries', id), { ...data, updatedAt: serverTimestamp() })

  const deleteEntry = async (id: string) =>
    deleteDoc(doc(db, 'time_entries', id))

  const approveWeek = async (weekStart: string, approvedBy: string) => {
    const existing = approvals.find(a => a.weekStart === weekStart)
    const payload  = { employeeId, weekStart, status: 'approved', approvedBy, approvedAt: serverTimestamp() }
    if (existing) await updateDoc(doc(db, 'timesheet_approvals', existing.id), payload)
    else           await addDoc(collection(db, 'timesheet_approvals'), payload)
  }

  const clockIn = async (projectTask?: string, note?: string) => {
    const now   = new Date()
    const hh    = String(now.getHours()).padStart(2, '0')
    const mm    = String(now.getMinutes()).padStart(2, '0')
    await addEntry({ employeeId, date: toYMD(now), startTime: `${hh}:${mm}`, hours: 0, type: 'regular', clockedIn: true, projectTask: projectTask ?? '', note: note ?? '' })
  }

  const clockOut = async (entryId: string, startTime: string) => {
    const now = new Date()
    const hh  = String(now.getHours()).padStart(2, '0')
    const mm  = String(now.getMinutes()).padStart(2, '0')
    const endTime = `${hh}:${mm}`
    await updateEntry(entryId, { endTime, hours: calcHours(startTime, endTime), clockedIn: false })
  }

  return {
    entries, approvals, loading,
    addEntry, updateEntry, deleteEntry,
    approveWeek, clockIn, clockOut,
    currentlyClockedIn: entries.find(e => e.clockedIn),
  }
}

// ── All-employees hook (Payroll Hours) ────────────────────────────────
export function useAllTimesheets(dateFrom: string, dateTo: string) {
  const [entries,   setEntries]   = useState<TimeEntry[]>([])
  const [approvals, setApprovals] = useState<TimesheetApproval[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!dateFrom) return
    const q = query(
      collection(db, 'time_entries'),
      where('date', '>=', dateFrom),
      where('date', '<=', dateTo),
    )
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimeEntry)))
      setLoading(false)
    }, () => setLoading(false))
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!dateFrom) return
    const q = query(collection(db, 'timesheet_approvals'), where('weekStart', '>=', dateFrom))
    return onSnapshot(q, snap =>
      setApprovals(snap.docs.map(d => ({ id: d.id, ...d.data() } as TimesheetApproval)))
    )
  }, [dateFrom])

  return { entries, approvals, loading }
}
