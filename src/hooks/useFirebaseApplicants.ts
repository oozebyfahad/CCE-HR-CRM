import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, serverTimestamp,
  getDocs, where,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export interface Applicant {
  id: string
  // Personal
  name: string
  email: string
  phone: string
  dob?: string
  gender?: string
  cnic?: string
  currentAddress?: string
  // Application
  positionApplied: string
  department: string
  experience?: string
  education?: string
  coverLetter?: string
  cvLink?: string
  // Status
  status: 'new' | 'reviewing' | 'shortlisted' | 'hired' | 'rejected'
  appliedBefore?: boolean
  appliedBeforeRole?: string
  // Meta
  appliedDate: string
  createdAt?: unknown
}

export interface RejectedRecord {
  id: string
  name: string
  email: string
  cnic?: string
  positionApplied: string
  rejectedDate: string
}

// ── Check if email/cnic was previously rejected ─────────────────────────
export async function checkPreviouslyRejected(
  email: string,
  cnic?: string,
): Promise<RejectedRecord | null> {
  const col = collection(db, 'rejected')

  const byEmail = await getDocs(query(col, where('email', '==', email.toLowerCase().trim())))
  if (!byEmail.empty) return { id: byEmail.docs[0].id, ...byEmail.docs[0].data() } as RejectedRecord

  if (cnic && cnic.trim()) {
    const byCnic = await getDocs(query(col, where('cnic', '==', cnic.trim())))
    if (!byCnic.empty) return { id: byCnic.docs[0].id, ...byCnic.docs[0].data() } as RejectedRecord
  }

  return null
}

// ── Hook ────────────────────────────────────────────────────────────────
export function useFirebaseApplicants() {
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [rejected,   setRejected]   = useState<RejectedRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

  useEffect(() => {
    const q1 = query(collection(db, 'applicants'), orderBy('createdAt', 'desc'))
    const q2 = query(collection(db, 'rejected'),   orderBy('rejectedDate', 'desc'))

    const unsub1 = onSnapshot(q1, snap => {
      setApplicants(snap.docs.map(d => ({ id: d.id, ...d.data() } as Applicant)))
      setLoading(false)
    }, err => { setError(err.message); setLoading(false) })

    const unsub2 = onSnapshot(q2, snap => {
      setRejected(snap.docs.map(d => ({ id: d.id, ...d.data() } as RejectedRecord)))
    })

    return () => { unsub1(); unsub2() }
  }, [])

  const updateApplicant = async (id: string, data: Partial<Applicant>) => {
    await updateDoc(doc(db, 'applicants', id), data)
  }

  // Reject: delete full record, store minimal entry in rejected
  const rejectApplicant = async (applicant: Applicant) => {
    await addDoc(collection(db, 'rejected'), {
      name:            applicant.name,
      email:           applicant.email.toLowerCase().trim(),
      cnic:            applicant.cnic ?? '',
      positionApplied: applicant.positionApplied,
      rejectedDate:    new Date().toISOString().split('T')[0],
    })
    await deleteDoc(doc(db, 'applicants', applicant.id))
  }

  // Hire: delete from applicants (caller handles adding to employees)
  const removeApplicant = async (id: string) => {
    await deleteDoc(doc(db, 'applicants', id))
  }

  return {
    applicants, rejected, loading, error,
    updateApplicant, rejectApplicant, removeApplicant,
  }
}
