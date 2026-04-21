import { useState, useRef, useCallback } from 'react'
import { Upload, ChevronRight, ChevronLeft, Check, X, AlertCircle, FileSpreadsheet, Download } from 'lucide-react'
import {
  IMPORT_FIELDS,
  parseExcelFile,
  autoDetectMapping,
  mapRowToEmployee,
  downloadImportTemplate,
  type ParsedSheet,
} from '../../../utils/importExcel'
import type { FirebaseEmployee } from '../../../hooks/useFirebaseEmployees'
import { cn } from '../../../utils/cn'

// ── Types ────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3

interface Props {
  onImport: (employees: Omit<FirebaseEmployee, 'id'>[]) => Promise<void>
  onClose:  () => void
}

// ── Step indicator ───────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps = ['Upload File', 'Map Columns', 'Preview & Import']
  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((label, i) => {
        const n = (i + 1) as Step
        const done    = current > n
        const active  = current === n
        return (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2 shrink-0">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                done   ? 'bg-green-500 text-white'  :
                active ? 'bg-primary text-white'    :
                         'bg-gray-100 text-gray-400'
              )}>
                {done ? <Check size={12} /> : n}
              </div>
              <span className={cn('text-xs font-medium hidden sm:block',
                active ? 'text-secondary' : 'text-gray-400'
              )}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('flex-1 h-px mx-2', current > n ? 'bg-green-400' : 'bg-gray-200')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main modal ───────────────────────────────────────────────────────────
export default function ImportEmployeeModal({ onImport, onClose }: Props) {
  const [step,      setStep]      = useState<Step>(1)
  const [sheet,     setSheet]     = useState<ParsedSheet | null>(null)
  const [mapping,   setMapping]   = useState<Record<string, string>>({})
  const [preview,   setPreview]   = useState<Omit<FirebaseEmployee, 'id'>[]>([])
  const [importing, setImporting] = useState(false)
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState('')
  const [fileName,  setFileName]  = useState('')
  const [dragging,  setDragging]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Step 1: file pick / drop ─────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setError('')
    try {
      const parsed = await parseExcelFile(file)
      setSheet(parsed)
      setFileName(file.name)
      setMapping(autoDetectMapping(parsed.headers))
      setStep(2)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to parse file.')
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  // ── Step 2 → 3: validate mapping and build preview ──────────────────
  const buildPreview = () => {
    const missing = IMPORT_FIELDS.filter(f => f.required && !mapping[f.key])
    if (missing.length) {
      setError(`Map required fields first: ${missing.map(f => f.label).join(', ')}`)
      return
    }
    setError('')
    const rows = sheet!.rows.map(r => mapRowToEmployee(r, mapping))
    setPreview(rows)
    setStep(3)
  }

  // ── Step 3: import to Firestore ─────────────────────────────────────
  const handleImport = async () => {
    setImporting(true)
    setError('')
    try {
      await onImport(preview)
      setDone(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import failed.')
      setImporting(false)
    }
  }

  // ── Done screen ──────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={30} className="text-green-500" />
          </div>
          <h3 className="text-lg font-bold text-secondary mb-1">Import Complete</h3>
          <p className="text-sm text-gray-500 mb-6">{preview.length} employee{preview.length !== 1 ? 's' : ''} added to your directory.</p>
          <button onClick={onClose} className="btn-primary w-full">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-bold text-secondary">Import Employees from Excel</h3>
            <p className="text-xs text-gray-400 mt-0.5">Upload your spreadsheet and map columns to system fields</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepBar current={step} />

          {/* ── STEP 1: Upload ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragEnter={() => setDragging(true)}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  dragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                )}>
                <FileSpreadsheet size={36} className={cn('mx-auto mb-3', dragging ? 'text-primary' : 'text-gray-300')} />
                <p className="font-semibold text-gray-600 text-sm">Drop your Excel or CSV file here</p>
                <p className="text-xs text-gray-400 mt-1">or click to browse · .xlsx, .xls, .csv accepted</p>
                <input ref={fileRef} type="file" className="hidden" accept=".xlsx,.xls,.csv"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                <AlertCircle size={13} className="shrink-0" />
                <span>Don't have a template?</span>
                <button
                  onClick={e => { e.stopPropagation(); downloadImportTemplate() }}
                  className="flex items-center gap-1 font-semibold underline underline-offset-2 ml-auto shrink-0">
                  <Download size={11} /> Download Template
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Map columns ── */}
          {step === 2 && sheet && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                File: <span className="font-medium text-secondary">{fileName}</span> ·{' '}
                {sheet.rows.length} row{sheet.rows.length !== 1 ? 's' : ''} detected
              </p>
              <p className="text-xs text-gray-400">Fields auto-mapped where possible. Review and fix any mismatches.</p>

              <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                {IMPORT_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-4 px-4 py-2.5 bg-white hover:bg-gray-50/50">
                    <div className="w-44 shrink-0">
                      <span className="text-sm font-medium text-secondary">{field.label}</span>
                      {field.required && <span className="ml-1 text-red-400 text-xs">*</span>}
                    </div>
                    <ChevronRight size={12} className="text-gray-300 shrink-0" />
                    <select
                      value={mapping[field.key] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                      className={cn(
                        'input flex-1 text-sm',
                        mapping[field.key] ? 'text-secondary' : 'text-gray-400'
                      )}>
                      <option value="">— not mapped —</option>
                      {sheet.headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    {mapping[field.key]
                      ? <Check size={13} className="text-green-500 shrink-0" />
                      : <span className="w-3.5 shrink-0" />
                    }
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Previewing <span className="font-semibold text-secondary">{preview.length}</span> employees. Review before importing.
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Name', 'Email', 'Emp ID', 'Department', 'Job Title', 'Start Date', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.slice(0, 50).map((emp, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 font-medium text-secondary whitespace-nowrap">{emp.name || <span className="text-red-400">Missing</span>}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{emp.email || '—'}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{emp.employeeId || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{emp.department || '—'}</td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{emp.jobTitle || '—'}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{emp.startDate || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-semibold',
                            emp.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          )}>{emp.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 50 && (
                <p className="text-xs text-gray-400 text-center">Showing first 50 of {preview.length} rows</p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 rounded-lg text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => { setError(''); setStep(s => Math.max(1, s - 1) as Step) }}
            disabled={step === 1}
            className="btn-outline text-sm gap-1.5 disabled:opacity-0">
            <ChevronLeft size={14} /> Back
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className="btn-outline text-sm">Cancel</button>
            {step === 1 && (
              <button onClick={() => fileRef.current?.click()} className="btn-primary text-sm gap-2">
                <Upload size={14} /> Choose File
              </button>
            )}
            {step === 2 && (
              <button onClick={buildPreview} className="btn-primary text-sm gap-1.5">
                Preview <ChevronRight size={14} />
              </button>
            )}
            {step === 3 && (
              <button onClick={handleImport} disabled={importing} className="btn-primary text-sm gap-2 disabled:opacity-60">
                {importing ? 'Importing…' : `Import ${preview.length} Employee${preview.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
