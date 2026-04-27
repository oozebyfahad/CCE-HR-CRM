import { useState, useEffect } from 'react'
import {
  FolderOpen, FileText, Download, Eye, Search,
  Shield, Briefcase, GraduationCap, ScrollText,
} from 'lucide-react'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { useAppSelector } from '../../store'
import { useMyEmployee } from '../../hooks/useMyEmployee'

interface EmployeeDocument {
  id: string
  employeeId: string
  title: string
  category: 'contract' | 'policy' | 'certificate' | 'letter' | 'other'
  fileUrl: string
  fileType: string
  uploadedBy: string
  createdAt: { seconds: number } | null
  description?: string
}

const CATEGORIES = [
  { v: 'all',         l: 'All Documents' },
  { v: 'contract',    l: 'Contracts'     },
  { v: 'policy',      l: 'Policies'      },
  { v: 'certificate', l: 'Certificates'  },
  { v: 'letter',      l: 'Letters'       },
  { v: 'other',       l: 'Other'         },
]

const CAT_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string; badge: string }> = {
  contract:    { icon: Briefcase,     bg: 'bg-blue-50',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'    },
  policy:      { icon: Shield,        bg: 'bg-purple-50',  text: 'text-purple-600',  badge: 'bg-purple-100 text-purple-700'},
  certificate: { icon: GraduationCap, bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700'},
  letter:      { icon: ScrollText,    bg: 'bg-amber-50',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700'  },
  other:       { icon: FileText,      bg: 'bg-gray-100',   text: 'text-gray-500',    badge: 'bg-gray-100 text-gray-600'    },
}

function fmtDate(ts: { seconds: number } | null) {
  if (!ts) return '—'
  return new Date(ts.seconds * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyDocuments() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employee: myEmployee } = useMyEmployee(currentUser?.email)

  const [docs, setDocs]         = useState<EmployeeDocument[]>([])
  const [category, setCategory] = useState('all')
  const [search, setSearch]     = useState('')

  useEffect(() => {
    if (!myEmployee) return
    const q = query(
      collection(db, 'employee_documents'),
      where('employeeId', '==', myEmployee.id),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(q, snap => {
      setDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as EmployeeDocument)))
    })
  }, [myEmployee?.id])

  const filtered = docs.filter(d => {
    const matchCat = category === 'all' || d.category === category
    const matchSearch = !search || d.title.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const countByCategory = (cat: string) => cat === 'all' ? docs.length : docs.filter(d => d.category === cat).length

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-3xl p-8 text-white"
        style={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #12121E 60%, #0a1428 100%)' }}>
        <div className="absolute -top-16 right-16 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4), transparent 65%)' }} />
        <div className="absolute bottom-0 left-24 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.2), transparent 65%)' }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full mb-4">
            <FolderOpen size={12} className="text-indigo-400" />
            <span className="text-indigo-300 text-[11px] font-semibold tracking-wide">MY DOCUMENTS</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Document Vault</h1>
          <p className="text-white/50 text-sm mt-2">All your contracts, letters, certificates and company policies in one place.</p>

          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.slice(1).map(c => {
              const count = countByCategory(c.v)
              const cfg   = CAT_CONFIG[c.v]
              return (
                <div key={c.v} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] text-white/40 uppercase tracking-wide font-medium">{c.l}</p>
                  <p className="text-2xl font-bold text-white mt-1">{count}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c.v} onClick={() => setCategory(c.v)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                category === c.v
                  ? 'bg-secondary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {c.l} {c.v !== 'all' && `(${countByCategory(c.v)})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div className="card py-20 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-secondary">
            {search ? 'No documents match your search' : 'No documents yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            HR will upload your contracts, letters, and policies here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => {
            const cfg  = CAT_CONFIG[d.category] ?? CAT_CONFIG.other
            const Icon = cfg.icon
            return (
              <div key={d.id}
                className="card p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 group cursor-default">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${cfg.bg} group-hover:scale-110 transition-transform`}>
                    <Icon size={20} className={cfg.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-secondary leading-tight">{d.title}</p>
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${cfg.badge}`}>
                      {d.category}
                    </span>
                  </div>
                </div>

                {d.description && (
                  <p className="text-xs text-gray-400 leading-relaxed mb-4">{d.description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div>
                    <p className="text-[10px] text-gray-300">Uploaded by {d.uploadedBy}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(d.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-primary hover:text-white text-gray-500 transition-all">
                      <Eye size={13} />
                    </a>
                    <a href={d.fileUrl} download
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-primary hover:text-white text-gray-500 transition-all">
                      <Download size={13} />
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
