import { useState, type FormEvent } from 'react'
import cceLogo from '../../assets/CCE-Logo.png'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../store'
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice'

const DEMO_USERS = [
  { email: 'admin@cabcallexperts.com',   password: 'admin123',   name: 'HR Manager',   role: 'hr_admin'      as const, department: 'Human Resources' },
  { email: 'manager@cabcallexperts.com', password: 'manager123', name: 'Sarah Chen',   role: 'line_manager'  as const, department: 'Operations' },
  { email: 'staff@cabcallexperts.com',   password: 'staff123',   name: 'James Mitchell', role: 'employee'    as const, department: 'Operations' },
]

export default function Login() {
  const dispatch  = useAppDispatch()
  const navigate  = useNavigate()
  const { loading, error } = useAppSelector(s => s.auth)

  const [email,    setEmail]    = useState('admin@cabcallexperts.com')
  const [password, setPassword] = useState('admin123')
  const [showPw,   setShowPw]   = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    dispatch(loginStart())

    await new Promise(r => setTimeout(r, 800))

    const found = DEMO_USERS.find(u => u.email === email && u.password === password)
    if (found) {
      dispatch(loginSuccess({ id: '1', name: found.name, email: found.email, role: found.role, department: found.department }))
      navigate('/dashboard')
    } else {
      dispatch(loginFailure('Invalid email or password. Try the demo credentials below.'))
    }
  }

  return (
    <div className="min-h-screen bg-secondary flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-secondary via-[#1e2a4a] to-[#0d2b45] p-14">
        <div className="flex items-center gap-3">
          <img src="logo-icon-white.png" alt="CCE Logo" className="w-10 h-10 object-contain" />
          <div>
            <p className="text-white font-semibold text-sm">CabCall Experts</p>
            <p className="text-gray-400 text-xs">cabcallexperts.com</p>
          </div>
        </div>

        <div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            People Management,<br />
            <span className="text-primary">Simplified.</span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm">
            A centralised HR platform built for CabCallExperts — track attendance, manage leave, monitor performance, and keep every employee record in one secure place.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: 'Employees',      value: '160' },
              { label: 'Departments',    value: '5' },
              { label: 'Leave Requests', value: '14' },
              { label: 'Open Vacancies', value: '5' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 rounded-xl p-4">
                <p className="text-white text-2xl font-bold">{s.value}</p>
                <p className="text-gray-400 text-xs mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-600 text-xs">© {new Date().getFullYear()} CabCallExperts. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#F0F4F8]">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src={cceLogo} alt="CCE Logo" className="w-10 h-10 object-contain" />
            <span className="text-secondary font-bold text-lg">CabCall Experts</span>
          </div>

          <div className="card p-8">
            <h3 className="text-xl font-bold text-secondary mb-1">Sign in</h3>
            <p className="text-sm text-gray-500 mb-6">HR Management System</p>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input pl-9"
                    placeholder="you@cabcallexperts.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pl-9 pr-9"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 mt-2">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-xs font-medium text-gray-500 mb-2">Demo Credentials</p>
              <div className="space-y-1.5">
                {DEMO_USERS.map(u => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword(u.password) }}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-primary-50 border border-gray-100 hover:border-primary/20 transition-colors"
                  >
                    <p className="text-xs font-medium text-secondary">{u.name} <span className="font-normal text-gray-400">({u.role.replace('_', ' ')})</span></p>
                    <p className="text-[10px] text-gray-400">{u.email}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
