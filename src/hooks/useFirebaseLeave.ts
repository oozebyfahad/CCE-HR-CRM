import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, doc,
  query, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { LeaveRequest, LeaveType } from '../types'

export interface NewLeaveRequest {
  employeeId:   string
  employeeName: string
  department:   string
  type:         LeaveType
  startDate:    string
  endDate:      string
  days:         number
  reason?:      string
  status:       'pending' | 'approved'
  loggedBy:     string
}

export function useFirebaseLeave() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'leave_requests'))
    return onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
      rows.sort((a, b) => {
        const at = (a as any).submittedAt?.seconds ?? 0
        const bt = (b as any).submittedAt?.seconds ?? 0
        return bt - at
      })
      setRequests(rows)
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const addRequest = async (data: NewLeaveRequest): Promise<void> => {
    await addDoc(collection(db, 'leave_requests'), {
      ...data,
      submittedAt: serverTimestamp(),
      updatedAt:   serverTimestamp(),
      ...(data.status === 'approved' ? {
        approvedBy:   data.loggedBy,
        approvedDate: new Date().toISOString().split('T')[0],
      } : {}),
    })
  }

  const approveRequest = (id: string, approvedBy: string) =>
    updateDoc(doc(db, 'leave_requests', id), {
      status: 'approved',
      approvedBy,
      approvedDate: new Date().toISOString().split('T')[0],
      updatedAt: serverTimestamp(),
    })

  const declineRequest = (id: string, declinedBy: string) =>
    updateDoc(doc(db, 'leave_requests', id), {
      status: 'declined',
      declinedBy,
      updatedAt: serverTimestamp(),
    })

  return { requests, loading, addRequest, approveRequest, declineRequest }
}
