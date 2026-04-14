import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  name: string
  onConfirm: () => Promise<void>
  onClose: () => void
}

export default function DeleteConfirmModal({ name, onConfirm, onClose }: Props) {
  const [step,    setStep]    = useState<1 | 2>(1)
  const [deleting, setDeleting] = useState(false)

  const handleFinal = async () => {
    setDeleting(true)
    try { await onConfirm() } finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <h2 className="font-bold text-secondary">Delete Employee</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <>
              <p className="text-gray-600 text-sm leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-secondary">{name}</span>?
                This will permanently remove their record from the system.
              </p>
              <div className="flex gap-3 mt-6">
                <button onClick={onClose} className="btn-outline flex-1 py-2.5 text-sm">Cancel</button>
                <button onClick={() => setStep(2)} className="flex-1 py-2.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition">
                  Yes, Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                <p className="text-red-700 text-sm font-semibold mb-1">⚠️ This action is irreversible</p>
                <p className="text-red-600 text-xs leading-relaxed">
                  All data for <strong>{name}</strong> — including attendance, payroll, and performance records — will be permanently deleted. You cannot undo this.
                </p>
              </div>
              <p className="text-gray-600 text-sm">Please confirm to proceed with permanent deletion.</p>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(1)} className="btn-outline flex-1 py-2.5 text-sm">← Go Back</button>
                <button onClick={handleFinal} disabled={deleting}
                  className="flex-1 py-2.5 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg font-semibold transition">
                  {deleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
