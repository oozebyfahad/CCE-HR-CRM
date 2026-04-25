import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { Shield, AlertTriangle } from 'lucide-react'
import { useAppSelector } from '../../store'
import { cn } from '../../utils/cn'
import type { DisciplinaryCase } from '../disciplinary/Disciplinary'

const TYPE_LABEL: Record<string, string> = {
  verbal_warning:  'Verbal Warning',
  written_warning: 'Written Warning',
  final_warning:   'Final Warning',
  suspension:      'Suspension',
  dismissal:       'Dismissal',
}

const TYPE_STYLE: Record<string, string> = {
  verbal_warning:  'bg-yellow-100 text-yellow-700 border-yellow-200',
  written_warning: 'bg-orange-100 text-orange-700 border-orange-200',
  final_warning:   'bg-red-100    text-red-700    border-red-200',
  suspension:      'bg-red-100    text-red-700    border-red-200',
  dismissal:       'bg-gray-900   text-white      border-gray-900',
}

const STATUS_STYLE: Record<string, string> = {
  open:     'bg-red-50   text-red-600   border-red-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
  appealed: 'bg-amber-50 text-amber-700 border-amber-200',
}

export default function MyDisciplinary() {
  const currentUser               = useAppSelector(s => s.auth.user)
  const [cases,   setCases]       = useState<DisciplinaryCase[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!currentUser?.email) return
    const q = query(
      collection(db, 'disciplinary'),
      where('employeeEmail', '==', currentUser.email),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, snap => {
      setCases(snap.docs.map(d => ({ id: d.id, ...d.data() } as DisciplinaryCase)))
      setLoading(false)
    }, () => setLoading(false))
  }, [currentUser?.email])

  return (
    <div className="space-y-5 max-w-2xl mx-auto">

      <div>
        <h2 className="page-header">My Disciplinary Records</h2>
        <p className="page-sub">Cases issued to you by HR</p>
      </div>

      {/* Privacy notice */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-800 leading-relaxed">
          These records are confidential. If you wish to appeal a decision or respond formally,
          please contact HR directly.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : cases.length === 0 ? (
        <div className="card py-16 text-center space-y-3">
          <Shield size={40} className="text-gray-200 mx-auto" />
          <p className="text-sm font-semibold text-gray-400">No disciplinary records</p>
          <p className="text-xs text-gray-400">You have no disciplinary cases on file.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cases.map(c => (
            <div key={c.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border', TYPE_STYLE[c.caseType])}>
                    {TYPE_LABEL[c.caseType]}
                  </span>
                  <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full border capitalize', STATUS_STYLE[c.status])}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                  {c.date ? new Date(c.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm text-gray-800 leading-relaxed">{c.reason}</p>
              </div>

              {c.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Additional Notes</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{c.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <p className="text-xs text-gray-400">Issued by <span className="font-semibold text-gray-600">{c.issuedBy}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
