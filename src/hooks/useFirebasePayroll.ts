import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, serverTimestamp, where, getDocs,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { calcPayroll, type PayrollResult } from '../utils/payroll'
import type { FirebaseEmployee } from './useFirebaseEmployees'

export type RunStatus = 'draft' | 'approved' | 'paid'

export interface PayrollEntry {
  id:                string
  runId:             string
  employeeId:        string
  employeeName:      string
  department:        string
  payType:           string
  hoursWorked:       number
  paidHolidayHours:  number
  eidDays:           number
  qualityBonus:      number
  result:            PayrollResult
  notes?:            string
}

export interface PayrollRun {
  id:          string
  month:       string   // 'YYYY-MM'
  label:       string   // e.g. 'April 2026'
  status:      RunStatus
  totalGross:  number
  totalNet:    number
  totalTax:    number
  totalEobi:   number
  headcount:   number
  createdAt?:  unknown
  approvedBy?: string
  approvedAt?: unknown
  paidAt?:     unknown
}

export function useFirebasePayroll() {
  const [runs,    setRuns]    = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'payroll_runs'), orderBy('month', 'desc'))
    return onSnapshot(q, snap => {
      setRuns(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollRun)))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  // ── Create a draft run ──────────────────────────────────────────────
  const createRun = async (
    month: string,
    employees: FirebaseEmployee[],
    hoursMap:         Record<string, number>,  // empId → hoursWorked
    advanceMap:       Record<string, number>,  // empId → advance repayment
    loanMap:          Record<string, number>,  // empId → loan instalment
    otherDeductMap:   Record<string, number>,
    otherAddMap:      Record<string, number>,
    // Per-run variable pay (default 0 for all unless specified)
    qualityBonusMap:      Record<string, number>,  // empId → PKR
    eidDaysMap:           Record<string, number>,  // empId → number of Eid days
    paidHolidayHoursMap:  Record<string, number>,  // empId → holiday hours
  ): Promise<string> => {
    const d     = new Date(month + '-01')
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    const entries: Omit<PayrollEntry, 'id'>[] = []

    for (const emp of employees) {
      if (emp.status !== 'active') continue
      const hours            = hoursMap[emp.id] ?? 0
      const paidHolidayHours = paidHolidayHoursMap[emp.id] ?? 0
      const eidDays          = eidDaysMap[emp.id]          ?? 0
      const qualityBonus     = qualityBonusMap[emp.id]     ?? 0

      const result = calcPayroll({
        payType:           (emp.payType as 'hourly' | 'fixed_monthly') ?? 'fixed_monthly',
        monthlySalary:     emp.salary,
        monthlyHours:      emp.monthlyHours ?? 160,
        overtimeRate:      emp.overtimeRate,
        hourlyRate:        emp.hourlyRate,
        hoursWorked:       hours,
        paidHolidayHours,
        eidDays,
        fuelAllowance:     emp.fuelAllowance     ?? 0,
        gymAllowance:      emp.gymAllowance      ?? 0,
        qualityBonus,
        otherAdditions:    otherAddMap[emp.id]   ?? 0,
        eobi:              emp.eobi ?? false,
        advances:          advanceMap[emp.id]    ?? 0,
        loans:             loanMap[emp.id]       ?? 0,
        securityDeduction: emp.securityDeduction ?? 0,
        otherDeductions:   otherDeductMap[emp.id] ?? 0,
      })

      entries.push({
        runId: '',
        employeeId:       emp.id,
        employeeName:     emp.name,
        department:       emp.department,
        payType:          emp.payType ?? 'fixed_monthly',
        hoursWorked:      hours,
        paidHolidayHours,
        eidDays,
        qualityBonus,
        result,
      })
    }

    const totalGross = entries.reduce((s, e) => s + e.result.grossPay, 0)
    const totalNet   = entries.reduce((s, e) => s + e.result.netPay,   0)
    const totalTax   = entries.reduce((s, e) => s + e.result.withholdingTax, 0)
    const totalEobi  = entries.reduce((s, e) => s + e.result.eobiEmployee,   0)

    const runRef = await addDoc(collection(db, 'payroll_runs'), {
      month, label, status: 'draft',
      totalGross, totalNet, totalTax, totalEobi,
      headcount: entries.length,
      createdAt: serverTimestamp(),
    })

    // Write entries as sub-collection
    for (const entry of entries) {
      await addDoc(collection(db, 'payroll_runs', runRef.id, 'entries'), {
        ...entry, runId: runRef.id,
      })
    }

    return runRef.id
  }

  // ── Fetch entries for a specific run ───────────────────────────────
  const getEntries = async (runId: string): Promise<PayrollEntry[]> => {
    const snap = await getDocs(
      query(collection(db, 'payroll_runs', runId, 'entries'), orderBy('employeeName'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PayrollEntry))
  }

  // ── Approve a run ──────────────────────────────────────────────────
  const approveRun = async (runId: string, approvedBy: string) => {
    await updateDoc(doc(db, 'payroll_runs', runId), {
      status: 'approved', approvedBy, approvedAt: serverTimestamp(),
    })
  }

  // ── Mark as paid ───────────────────────────────────────────────────
  const markPaid = async (runId: string) => {
    await updateDoc(doc(db, 'payroll_runs', runId), {
      status: 'paid', paidAt: serverTimestamp(),
    })
  }

  // ── Delete draft run ───────────────────────────────────────────────
  const deleteRun = async (runId: string) => {
    // delete entries first
    const snap = await getDocs(collection(db, 'payroll_runs', runId, 'entries'))
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)))
    await deleteDoc(doc(db, 'payroll_runs', runId))
  }

  // ── Update a single entry (manual override) ────────────────────────
  const updateEntry = async (runId: string, entryId: string, patch: Partial<PayrollEntry>) => {
    await updateDoc(doc(db, 'payroll_runs', runId, 'entries', entryId), patch as Record<string, unknown>)
    // recalculate run totals
    const entries = await getEntries(runId)
    await updateDoc(doc(db, 'payroll_runs', runId), {
      totalGross: entries.reduce((s, e) => s + e.result.grossPay, 0),
      totalNet:   entries.reduce((s, e) => s + e.result.netPay,   0),
      totalTax:   entries.reduce((s, e) => s + e.result.withholdingTax, 0),
      totalEobi:  entries.reduce((s, e) => s + e.result.eobiEmployee,   0),
    })
  }

  return { runs, loading, createRun, getEntries, approveRun, markPaid, deleteRun, updateEntry }
}
