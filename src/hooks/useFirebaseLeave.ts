import { useState, useEffect } from 'react'
import {
  collection, updateDoc, doc,
  query, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { LeaveRequest } from '../types'

export function useFirebaseLeave() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'leave_requests'))
    return onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRequest))
      // newest first — sort client-side to avoid needing a Firestore composite index
      rows.sort((a, b) => {
        const at = (a as any).submittedAt?.seconds ?? 0
        const bt = (b as any).submittedAt?.seconds ?? 0
        return bt - at
      })
      setRequests(rows)
      setLoading(false)
    }, () => setLoading(false))
  }, [])

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

  return { requests, loading, approveRequest, declineRequest }
}
