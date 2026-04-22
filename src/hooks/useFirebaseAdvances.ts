import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, serverTimestamp, where,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export type AdvanceStatus = 'pending' | 'approved' | 'repaying' | 'settled'
export type LoanStatus    = 'pending' | 'approved' | 'repaying' | 'settled'

export interface Advance {
  id:              string
  employeeId:      string
  employeeName:    string
  department:      string
  amount:          number          // original advance amount
  amountRepaid:    number          // total repaid so far
  monthlyDeduct:   number          // PKR deducted per month
  reason?:         string
  status:          AdvanceStatus
  requestedAt?:    unknown
  approvedAt?:     unknown
  approvedBy?:     string
  settledAt?:      unknown
}

export interface Loan {
  id:              string
  employeeId:      string
  employeeName:    string
  department:      string
  amount:          number          // principal
  amountRepaid:    number
  monthlyInstalment: number        // fixed monthly instalment
  totalInstalments:  number        // e.g. 12 months
  paidInstalments:   number
  purpose?:        string
  status:          LoanStatus
  requestedAt?:    unknown
  approvedAt?:     unknown
  approvedBy?:     string
  settledAt?:      unknown
}

// ── Advances ─────────────────────────────────────────────────────────
export function useFirebaseAdvances(employeeId?: string) {
  const [advances, setAdvances] = useState<Advance[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const base = collection(db, 'advances')
    const q = employeeId
      ? query(base, where('employeeId', '==', employeeId), orderBy('requestedAt', 'desc'))
      : query(base, orderBy('requestedAt', 'desc'))
    return onSnapshot(q, snap => {
      setAdvances(snap.docs.map(d => ({ id: d.id, ...d.data() } as Advance)))
      setLoading(false)
    }, () => setLoading(false))
  }, [employeeId])

  const requestAdvance = async (data: Omit<Advance, 'id' | 'amountRepaid' | 'status' | 'requestedAt'>) => {
    await addDoc(collection(db, 'advances'), {
      ...data, amountRepaid: 0, status: 'pending', requestedAt: serverTimestamp(),
    })
  }

  const approveAdvance = async (id: string, approvedBy: string) => {
    await updateDoc(doc(db, 'advances', id), {
      status: 'repaying', approvedBy, approvedAt: serverTimestamp(),
    })
  }

  const recordRepayment = async (id: string, amount: number, newTotal: number, originalAmount: number) => {
    const settled = newTotal >= originalAmount
    await updateDoc(doc(db, 'advances', id), {
      amountRepaid: newTotal,
      status: settled ? 'settled' : 'repaying',
      ...(settled ? { settledAt: serverTimestamp() } : {}),
    })
  }

  const deleteAdvance = async (id: string) => deleteDoc(doc(db, 'advances', id))

  return { advances, loading, requestAdvance, approveAdvance, recordRepayment, deleteAdvance }
}

// ── Loans ─────────────────────────────────────────────────────────────
export function useFirebaseLoans(employeeId?: string) {
  const [loans,   setLoans]   = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const base = collection(db, 'loans')
    const q = employeeId
      ? query(base, where('employeeId', '==', employeeId), orderBy('requestedAt', 'desc'))
      : query(base, orderBy('requestedAt', 'desc'))
    return onSnapshot(q, snap => {
      setLoans(snap.docs.map(d => ({ id: d.id, ...d.data() } as Loan)))
      setLoading(false)
    }, () => setLoading(false))
  }, [employeeId])

  const requestLoan = async (data: Omit<Loan, 'id' | 'amountRepaid' | 'paidInstalments' | 'status' | 'requestedAt'>) => {
    await addDoc(collection(db, 'loans'), {
      ...data, amountRepaid: 0, paidInstalments: 0, status: 'pending', requestedAt: serverTimestamp(),
    })
  }

  const approveLoan = async (id: string, approvedBy: string) => {
    await updateDoc(doc(db, 'loans', id), {
      status: 'repaying', approvedBy, approvedAt: serverTimestamp(),
    })
  }

  const recordInstalment = async (
    id: string, instalment: number, newTotal: number,
    paidInstalments: number, totalInstalments: number, principal: number,
  ) => {
    const settled = paidInstalments >= totalInstalments || newTotal >= principal
    await updateDoc(doc(db, 'loans', id), {
      amountRepaid: newTotal,
      paidInstalments,
      status: settled ? 'settled' : 'repaying',
      ...(settled ? { settledAt: serverTimestamp() } : {}),
    })
  }

  const deleteLoan = async (id: string) => deleteDoc(doc(db, 'loans', id))

  return { loans, loading, requestLoan, approveLoan, recordInstalment, deleteLoan }
}

// ── Combined monthly deduction totals for payroll ─────────────────────
// Returns { advance: PKR, loan: PKR } for a given employee
export function monthlyDeductions(
  advances: Advance[],
  loans: Loan[],
  employeeId: string,
) {
  const advance = advances
    .filter(a => a.employeeId === employeeId && a.status === 'repaying')
    .reduce((s, a) => s + (a.monthlyDeduct ?? 0), 0)

  const loan = loans
    .filter(l => l.employeeId === employeeId && l.status === 'repaying')
    .reduce((s, l) => s + (l.monthlyInstalment ?? 0), 0)

  return { advance, loan }
}
