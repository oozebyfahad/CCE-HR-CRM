import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../config/firebase'

export interface CallRecording {
  id:          string
  callID:      string
  duration:    number
  durationFmt: string
  datetime:    string
  source:      string
  destination: string
  isProtected: boolean
  filename:    string
  url:         string
}

export function useFirebaseRecordings() {
  const [recordings, setRecordings] = useState<CallRecording[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'call_recordings'),
      orderBy('datetime', 'desc')
    )

    const unsub = onSnapshot(
      q,
      snap => {
        setRecordings(snap.docs.map(d => d.data() as CallRecording))
        setLoading(false)
      },
      _err => {
        // Silently ignore — collection doesn't exist yet until webhook is configured
        setLoading(false)
      }
    )

    return unsub
  }, [])

  return { recordings, loading }
}
