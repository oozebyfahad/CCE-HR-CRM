import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../../config/firebase'
import { useAppDispatch } from '../../store'
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice'
import type { UserRole } from '../../types'

// ── WebGL Shader Sources ───────────────────────────────────────────────
const vertexSource = `
  attribute vec4 a_position;
  void main() { gl_Position = a_position; }
`

const fragmentSource = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform vec2 iMouse;
uniform vec3 u_color;

void mainImage(out vec4 fragColor, in vec2 fragCoord){
  vec2 uv = fragCoord / iResolution;
  vec2 centeredUV = (2.0 * fragCoord - iResolution.xy) / min(iResolution.x, iResolution.y);
  float time = iTime * 0.5;
  vec2 mouse = iMouse / iResolution;
  vec2 rippleCenter = 2.0 * mouse - 1.0;
  vec2 distortion = centeredUV;
  for (float i = 1.0; i < 8.0; i++) {
    distortion.x += 0.5 / i * cos(i * 2.0 * distortion.y + time + rippleCenter.x * 3.1415);
    distortion.y += 0.5 / i * cos(i * 2.0 * distortion.x + time + rippleCenter.y * 3.1415);
  }
  float wave = abs(sin(distortion.x + distortion.y + time));
  float glow = smoothstep(0.9, 0.2, wave);
  fragColor = vec4(u_color * glow, 1.0);
}

void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }
`

// ── Role configuration ─────────────────────────────────────────────────
const ROLE_TABS = [
  {
    id: 'admin',
    label: 'Admin / HR',
    emoji: '🛡️',
    roles: ['hr_admin', 'hr_officer', 'super_admin'] as UserRole[],
    color: '#3B82F6',
  },
  {
    id: 'team_lead',
    label: 'Team Lead',
    emoji: '👥',
    roles: ['line_manager'] as UserRole[],
    color: '#8B5CF6',
  },
  {
    id: 'employee',
    label: 'Employee',
    emoji: '👤',
    roles: ['employee'] as UserRole[],
    color: '#10B981',
  },
]

// ── Smokey WebGL Background ────────────────────────────────────────────
function SmokeyBackground({ color = '#1E3A8A' }: { color?: string }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const mouseRef   = useRef({ x: 0, y: 0 })
  const hoverRef   = useRef(false)

  const hexToRgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl')
    if (!gl) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s)
      return s
    }

    const prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vertexSource))
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragmentSource))
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW)

    const pos = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const uRes   = gl.getUniformLocation(prog, 'iResolution')
    const uTime  = gl.getUniformLocation(prog, 'iTime')
    const uMouse = gl.getUniformLocation(prog, 'iMouse')
    const uColor = gl.getUniformLocation(prog, 'u_color')

    const [r, g, b] = hexToRgb(color)
    gl.uniform3f(uColor, r, g, b)

    const start = Date.now()
    let rafId: number

    const render = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight
      canvas.width = w; canvas.height = h
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uTime, (Date.now() - start) / 1000)
      gl.uniform2f(uMouse,
        hoverRef.current ? mouseRef.current.x : w / 2,
        hoverRef.current ? h - mouseRef.current.y : h / 2
      )
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      rafId = requestAnimationFrame(render)
    }

    const onMove  = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top } }
    const onEnter = () => { hoverRef.current = true }
    const onLeave = () => { hoverRef.current = false }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseenter', onEnter)
    canvas.addEventListener('mouseleave', onLeave)
    render()

    return () => {
      cancelAnimationFrame(rafId)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseenter', onEnter)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [color])

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-0 backdrop-blur-sm" />
    </div>
  )
}

// ── Login Page ─────────────────────────────────────────────────────────
export default function Login() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [selectedTab, setSelectedTab] = useState(0)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const activeTab   = ROLE_TABS[selectedTab]
  const shaderColor = selectedTab === 0 ? '#1E3A8A' : selectedTab === 1 ? '#3B0764' : '#064E3B'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    dispatch(loginStart())

    try {
      // 1. Sign in with Firebase
      const { user: firebaseUser } = await signInWithEmailAndPassword(auth, email, password)

      // 2. Fetch Firestore profile
      const snap = await getDoc(doc(db, 'users', firebaseUser.uid))

      if (!snap.exists()) {
        setError('No profile found. Contact your administrator.')
        dispatch(loginFailure('No profile found.'))
        await auth.signOut()
        return
      }

      const profile = snap.data()
      const userRole: UserRole = profile.role

      // 3. Check role matches selected tab
      if (!activeTab.roles.includes(userRole)) {
        setError(`You don't have ${activeTab.label} access. Please select the correct role.`)
        dispatch(loginFailure('Role mismatch.'))
        await auth.signOut()
        return
      }

      // 4. Success
      dispatch(loginSuccess({
        id:         firebaseUser.uid,
        name:       profile.name       ?? firebaseUser.displayName ?? 'User',
        email:      firebaseUser.email ?? email,
        role:       userRole,
        department: profile.department ?? '',
        avatar:     profile.avatar,
      }))

      navigate('/dashboard')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.')
      } else if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Something went wrong. Please try again.')
      }
      dispatch(loginFailure(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gray-950 overflow-hidden">
      {/* Animated WebGL background */}
      <SmokeyBackground color={shaderColor} />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/CCE-Logo.png" alt="CabCall Experts" className="h-14 w-auto mx-auto mb-3 drop-shadow-lg" />
          <p className="text-white/50 text-sm tracking-wide">HR & CRM Portal</p>
        </div>

        {/* Glass card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8">

          {/* Role selector tabs */}
          <div className="flex gap-2 mb-8 bg-white/5 rounded-2xl p-1">
            {ROLE_TABS.map((tab, i) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setSelectedTab(i); setError('') }}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                  selectedTab === i
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <span className="text-lg">{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Welcome Back</h2>
            <p className="mt-1 text-sm text-white/50">Sign in as {activeTab.label}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">

            {/* Email */}
            <div className="relative z-0">
              <input
                type="email"
                id="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-white/30 appearance-none focus:outline-none focus:ring-0 focus:border-blue-400 peer"
                placeholder=" "
                required
              />
              <label
                htmlFor="email"
                className="absolute text-sm text-white/50 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:text-blue-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
              >
                <User className="inline-block mr-1.5 -mt-0.5" size={14} />
                Email Address
              </label>
            </div>

            {/* Password */}
            <div className="relative z-0">
              <input
                type={showPw ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="block py-2.5 px-0 w-full text-sm text-white bg-transparent border-0 border-b-2 border-white/30 appearance-none focus:outline-none focus:ring-0 focus:border-blue-400 peer pr-8"
                placeholder=" "
                required
              />
              <label
                htmlFor="password"
                className="absolute text-sm text-white/50 duration-300 transform -translate-y-6 scale-75 top-3 -z-10 origin-[0] peer-focus:text-blue-400 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-6"
              >
                <Lock className="inline-block mr-1.5 -mt-0.5" size={14} />
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-0 top-2.5 text-white/40 hover:text-white transition-colors"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex justify-end -mt-4">
              <a href="#" className="text-xs text-white/40 hover:text-white transition">Forgot Password?</a>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="group w-full flex items-center justify-center py-3.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold transition-all duration-300 shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-white/30 mt-6">
            Access restricted to authorised personnel only.
          </p>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          © {new Date().getFullYear()} CabCall Experts. All rights reserved.
        </p>
      </div>
    </div>
  )
}
