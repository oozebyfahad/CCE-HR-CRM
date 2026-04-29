import { useState, useMemo, useEffect, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Users, AlertCircle, Calendar, TrendingDown, Star,
  BookOpen, Banknote, Shield, Download, AlertTriangle,
  CheckCircle, Clock, Award, Activity, Search,
  ChevronUp, ChevronDown, FileText, UserX,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useFirebaseEmployees, type FirebaseEmployee } from '../../hooks/useFirebaseEmployees'
import { useFirebasePayroll } from '../../hooks/useFirebasePayroll'
import { fmtPKR } from '../../utils/payroll'
import { cn } from '../../utils/cn'
import {
  fetchRotaAttendance, fetchRotaShifts, fetchRotaLeave, fetchRotaLeaveTypes, monthToUnix,
  type RotaAttendance, type RotaShift, type RotaLeave, type RotaLeaveType,
} from '../../services/rotacloud'

// ── Constants ─────────────────────────────────────────────────────────
const DC = ['#2E86C1','#10B981','#F59E0B','#8B5CF6','#EF4444','#EC4899','#6366F1','#14B8A6','#F97316','#84CC16']
const TT = { fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }

// ── Shared UI ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = '#2E86C1', icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ElementType
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      {Icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide leading-none">{label}</p>
        <p className="text-xl font-bold text-secondary mt-0.5">{value}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function Insight({ type, children }: { type: 'info' | 'warning' | 'danger'; children: React.ReactNode }) {
  const s = { info: 'bg-blue-50 border-blue-200 text-blue-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', danger: 'bg-red-50 border-red-200 text-red-800' }
  const I = { info: Activity, warning: AlertTriangle, danger: AlertCircle }[type]
  return (
    <div className={cn('flex items-start gap-3 border rounded-xl px-4 py-3', s[type])}>
      <I size={14} className="mt-0.5 shrink-0" />
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-bold text-secondary">{children}</p>
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white">
      {children}
    </select>
  )
}

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([content], { type: 'text/csv' })), download: filename })
  a.click()
}

function exportExcel(name: string, headers: string[], rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), 'Report')
  XLSX.writeFile(wb, `CCE_${name}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ─────────────────────────────────────────────────────────────────────
// 1. HEADCOUNT REPORT
// ─────────────────────────────────────────────────────────────────────

function HeadcountReport({ employees }: { employees: FirebaseEmployee[] }) {
  const [deptF, setDeptF] = useState('All')
  const [typeF, setTypeF] = useState('All')

  const active = useMemo(() => employees.filter(e => !['resigned','terminated'].includes(e.status ?? '')), [employees])
  const depts  = useMemo(() => [...new Set(active.map(e => e.department ?? 'Unknown'))].sort(), [active])

  const filtered = useMemo(() => active.filter(e => {
    if (deptF !== 'All' && e.department !== deptF) return false
    if (typeF !== 'All' && e.employmentType !== typeF) return false
    return true
  }), [active, deptF, typeF])

  const empTypeCounts = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(e => { const t = e.employmentType ?? 'Not Set'; m[t] = (m[t] ?? 0) + 1 })
    return Object.entries(m).map(([name, value], i) => ({ name: name.replace('_', ' '), value, color: DC[i % DC.length] }))
  }, [filtered])

  const deptBar = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(e => { const d = e.department ?? 'Unknown'; m[d] = (m[d] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([dept, count]) => ({ dept, count }))
  }, [filtered])

  const payTypeByDept = useMemo(() => {
    const m: Record<string, { dept: string; hourly: number; fixed: number; none: number }> = {}
    filtered.forEach(e => {
      const d = e.department ?? 'Unknown'
      if (!m[d]) m[d] = { dept: d, hourly: 0, fixed: 0, none: 0 }
      if (e.payType === 'hourly') m[d].hourly++
      else if (e.payType === 'fixed_monthly') m[d].fixed++
      else m[d].none++
    })
    return Object.values(m).sort((a, b) => (b.hourly + b.fixed + b.none) - (a.hourly + a.fixed + a.none))
  }, [filtered])

  const fullTime  = filtered.filter(e => e.employmentType === 'full_time').length
  const partTime  = filtered.filter(e => e.employmentType === 'part_time').length
  const contract  = filtered.filter(e => e.employmentType === 'contract').length
  const largest   = deptBar[0]
  const under3    = deptBar.filter(d => d.count < 3)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">Workforce Overview</h2>
        <p className="page-sub">Headcount breakdown by department and employment type</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <FilterSelect value={deptF} onChange={setDeptF}>
          <option value="All">All Departments</option>
          {depts.map(d => <option key={d}>{d}</option>)}
        </FilterSelect>
        <FilterSelect value={typeF} onChange={setTypeF}>
          <option value="All">All Employment Types</option>
          <option value="full_time">Full-Time</option>
          <option value="part_time">Part-Time</option>
          <option value="contract">Contract</option>
          <option value="agency">Agency</option>
        </FilterSelect>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Headcount" value={filtered.length} icon={Users}  color="#2E86C1" />
        <StatCard label="Full-Time"        value={fullTime}        icon={Users}  color="#10B981" />
        <StatCard label="Part-Time"        value={partTime}        icon={Users}  color="#F59E0B" />
        <StatCard label="Contract"         value={contract}        icon={Users}  color="#8B5CF6" />
      </div>

      <div className="space-y-2">
        {largest && <Insight type="info">Largest department is <strong>{largest.dept}</strong> with <strong>{largest.count}</strong> staff members.</Insight>}
        {under3.length > 0 && <Insight type="warning">Understaffed departments (fewer than 3 staff): <strong>{under3.map(d => d.dept).join(', ')}</strong>.</Insight>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <SectionTitle>Employment Type Split</SectionTitle>
          <div className="flex items-center gap-4 mt-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={empTypeCounts} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                  {empTypeCounts.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {empTypeCounts.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-gray-500 capitalize">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-secondary">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card p-5">
          <SectionTitle>Headcount by Department</SectionTitle>
          <ResponsiveContainer width="100%" height={200} className="mt-3">
            <BarChart layout="vertical" data={deptBar} barSize={12} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={88} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="count" fill="#2E86C1" radius={[0, 4, 4, 0]} name="Staff" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 lg:col-span-2">
          <SectionTitle>Pay Type Breakdown by Department</SectionTitle>
          <ResponsiveContainer width="100%" height={200} className="mt-3">
            <BarChart data={payTypeByDept} barSize={18} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="dept" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="hourly" stackId="a" fill="#F59E0B" name="Hourly" />
              <Bar dataKey="fixed"  stackId="a" fill="#2E86C1" name="Fixed Monthly" />
              <Bar dataKey="none"   stackId="a" fill="#D1D5DB" name="Not Set" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 2. ABSENTEEISM REPORT
// ─────────────────────────────────────────────────────────────────────

function AbsenteeismReport({ employees }: { employees: FirebaseEmployee[] }) {
  const nowRef = useRef(new Date())
  const defaultMonth = `${nowRef.current.getFullYear()}-${String(nowRef.current.getMonth() + 1).padStart(2, '0')}`

  const [month,     setMonth]     = useState(defaultMonth)
  const [deptF,     setDeptF]     = useState('All')
  const [loading,   setLoading]   = useState(false)
  const [rawAtt,    setRawAtt]    = useState<RotaAttendance[]>([])
  const [rawShifts, setRawShifts] = useState<RotaShift[]>([])
  const fetchedRef = useRef(false)

  const rotaToEmp = useMemo(() => {
    const m = new Map<number, FirebaseEmployee>()
    employees.forEach(e => { if (e.rotacloudId) m.set(e.rotacloudId, e) })
    return m
  }, [employees])

  const depts = useMemo(() => [...new Set(employees.map(e => e.department ?? 'Unknown'))].sort(), [employees])

  const monthOptions = useMemo(() => {
    const opts: { val: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 12; i++) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      opts.push({ val, label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) })
    }
    return opts
  }, [])

  useEffect(() => {
    if (employees.length === 0 || fetchedRef.current) return
    fetchedRef.current = true
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const now    = new Date()
        const curMs  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const ref11  = new Date(now.getFullYear(), now.getMonth() - 11, 1)
        const refMs  = `${ref11.getFullYear()}-${String(ref11.getMonth() + 1).padStart(2, '0')}`
        const { start } = monthToUnix(refMs)
        const { end }   = monthToUnix(curMs)
        const [att, shifts] = await Promise.all([fetchRotaAttendance(start, end), fetchRotaShifts(start, end)])
        if (!cancelled) { setRawAtt(att); setRawShifts(shifts) }
      } catch { /* no RotaCloud key */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [employees.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const knownIds    = new Set(rotaToEmp.keys())
    const validShifts = rawShifts.filter(s => s.published && !s.deleted && !s.open && knownIds.has(s.user))
    const attKeys     = new Set<string>()
    rawAtt.filter(a => !a.deleted && a.in_time_clocked).forEach(a => {
      const d = new Date(a.in_time * 1000)
      attKeys.add(`${a.user}_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
    })
    const { start: cS, end: cE } = monthToUnix(month)
    const curShifts    = validShifts.filter(s => s.start_time >= cS && s.start_time <= cE)
    const isAbsent     = (s: RotaShift) => {
      const d = new Date(s.start_time * 1000)
      return !attKeys.has(`${s.user}_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
    }
    const absentShifts = curShifts.filter(isAbsent)
    const totalLate    = rawAtt.filter(a => !a.deleted && a.in_time_clocked && a.in_time >= cS && a.in_time <= cE && a.minutes_late > 0).length

    const dMap = new Map<string, { s: number; a: number }>()
    curShifts.forEach(s => {
      const dept = rotaToEmp.get(s.user)?.department ?? 'Unknown'
      const v = dMap.get(dept) ?? { s: 0, a: 0 }; v.s++; dMap.set(dept, v)
    })
    absentShifts.forEach(s => {
      const dept = rotaToEmp.get(s.user)?.department ?? 'Unknown'
      const v = dMap.get(dept) ?? { s: 0, a: 0 }; v.a++; dMap.set(dept, v)
    })
    const deptData = [...dMap.entries()]
      .map(([dept, { s, a }]) => ({ dept, rate: s > 0 ? +(a / s * 100).toFixed(1) : 0, absences: a }))
      .sort((x, y) => y.rate - x.rate)

    const DOW_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const dowS: Record<string,number> = {}, dowA: Record<string,number> = {}
    curShifts.forEach(s => { const d = DOW_NAMES[new Date(s.start_time*1000).getDay()]; dowS[d]=(dowS[d]??0)+1 })
    absentShifts.forEach(s => { const d = DOW_NAMES[new Date(s.start_time*1000).getDay()]; dowA[d]=(dowA[d]??0)+1 })
    const dowData = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
      .filter(d => (dowS[d]??0) > 0)
      .map(d => ({ day: d, absences: dowA[d]??0, pct: +((dowA[d]??0)/(dowS[d]??1)*100).toFixed(1) }))

    const trend: { month: string; rate: number }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const td = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const ms = `${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}`
      const { start: mS, end: mE } = monthToUnix(ms)
      const mShifts = validShifts.filter(s => s.start_time >= mS && s.start_time <= mE)
      trend.push({ month: td.toLocaleDateString('en-GB', { month: 'short' }), rate: mShifts.length > 0 ? +(mShifts.filter(isAbsent).length/mShifts.length*100).toFixed(1) : 0 })
    }
    return { totalAbsent: absentShifts.length, totalLate, deptData, dowData, trend }
  }, [rawAtt, rawShifts, month, rotaToEmp])

  const hasRota   = rotaToEmp.size > 0
  const filtered  = deptF === 'All' ? stats.deptData : stats.deptData.filter(d => d.dept === deptF)
  const highDepts = stats.deptData.filter(d => d.rate > 5)
  const maxAbs    = Math.max(...stats.dowData.map(d => d.absences), 1)
  const monPct    = stats.dowData.find(d => d.day==='Mon')?.pct ?? 0
  const wedPct    = stats.dowData.find(d => d.day==='Wed')?.pct ?? 0
  const friPct    = stats.dowData.find(d => d.day==='Fri')?.pct ?? 0
  const monFriHigh = wedPct > 0 && monPct > wedPct * 1.5 && friPct > wedPct * 1.5

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">Absence & Attendance Analysis</h2>
        <p className="page-sub">{hasRota ? 'Monthly absence rate from RotaCloud shifts & attendance' : 'Link RotaCloud IDs to employees to enable live data'}</p>
      </div>

      {!hasRota && <Insight type="warning">No RotaCloud IDs linked to employees. Add <strong>rotacloudId</strong> in employee profiles to enable live absence tracking.</Insight>}
      {loading && <div className="text-xs text-gray-400 py-6 text-center">Loading RotaCloud data…</div>}

      {hasRota && !loading && (
        <>
          <div className="flex gap-3 flex-wrap">
            <FilterSelect value={month} onChange={setMonth}>
              {monthOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
            </FilterSelect>
            <FilterSelect value={deptF} onChange={setDeptF}>
              <option value="All">All Departments</option>
              {depts.map(d => <option key={d}>{d}</option>)}
            </FilterSelect>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Absent Shifts"    value={stats.totalAbsent}                                                                                       icon={UserX}       color="#EF4444" sub="This month" />
            <StatCard label="Avg Absence Rate" value={stats.deptData.length > 0 ? `${(stats.deptData.reduce((s,d)=>s+d.rate,0)/stats.deptData.length).toFixed(1)}%` : '—'} icon={Activity}    color="#F97316" />
            <StatCard label="Most Absent Dept" value={stats.deptData[0]?.dept ?? '—'}                                                                          icon={AlertCircle} color="#8B5CF6" />
            <StatCard label="Late Arrivals"    value={stats.totalLate}                                                                                         icon={Clock}       color="#F59E0B" sub="This month" />
          </div>

          <div className="space-y-2">
            {highDepts.map(d => <Insight key={d.dept} type="danger"><strong>{d.dept}</strong> absence rate of <strong>{d.rate}%</strong> exceeds the 5% warning threshold.</Insight>)}
            {monFriHigh && <Insight type="warning">Monday and Friday absences are significantly higher than mid-week — potential pattern detected.</Insight>}
            {stats.totalAbsent === 0 && rawShifts.length > 0 && <Insight type="info">No absences recorded for this period — all scheduled shifts were attended.</Insight>}
            {rawShifts.length === 0 && <Insight type="info">No shift data returned from RotaCloud for this period. Check that the API key is configured and shifts are published.</Insight>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <SectionTitle>Absence Rate Trend — 12 Months</SectionTitle>
              <ResponsiveContainer width="100%" height={180} className="mt-3">
                <LineChart data={stats.trend} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, 'auto']} />
                  <Tooltip contentStyle={TT} formatter={v => [`${v}%`, 'Absence Rate']} />
                  <Line type="monotone" dataKey="rate" stroke="#EF4444" strokeWidth={2} dot={{ r: 3, fill: '#EF4444' }} name="Absence %" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card p-5">
              <SectionTitle>Absence by Department</SectionTitle>
              {filtered.length === 0
                ? <div className="h-40 flex items-center justify-center text-xs text-gray-400">No absence data for selected filters</div>
                : <ResponsiveContainer width="100%" height={200} className="mt-3">
                    <BarChart layout="vertical" data={filtered} barSize={12} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
                      <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={88} />
                      <Tooltip contentStyle={TT} formatter={v => [`${v}%`, 'Rate']} />
                      <Bar dataKey="rate" fill="#EF4444" radius={[0, 4, 4, 0]} name="Absence Rate" />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>

            <div className="card p-5 lg:col-span-2">
              <SectionTitle>Absence Frequency by Day of Week</SectionTitle>
              {stats.dowData.length === 0
                ? <div className="h-32 flex items-center justify-center text-xs text-gray-400">No shift data for selected month</div>
                : <div className="mt-5 flex items-end justify-center gap-6">
                    {stats.dowData.map(d => {
                      const intensity = d.absences / maxAbs
                      const isHigh    = d.pct > 5
                      return (
                        <div key={d.day} className="flex flex-col items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">{d.absences}</span>
                          <div className="w-14 rounded-lg transition-all"
                            style={{ height: `${Math.max(24, intensity * 120)}px`, backgroundColor: isHigh ? '#EF4444' : `rgba(46,134,193,${0.2 + intensity * 0.8})` }} />
                          <span className={cn('text-xs font-bold', isHigh ? 'text-red-600' : 'text-gray-500')}>{d.day}</span>
                          <span className="text-[10px] text-gray-400">{d.pct}%</span>
                        </div>
                      )
                    })}
                  </div>
              }
              <p className="text-[10px] text-gray-400 text-center mt-3">Bar height = absent shifts · Red = above 5% · % = share of scheduled shifts</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 3. LEAVE USAGE REPORT
// ─────────────────────────────────────────────────────────────────────

function LeaveUsageReport({ employees }: { employees: FirebaseEmployee[] }) {
  const currentYear = new Date().getFullYear()
  const [yearF,    setYearF]    = useState(String(currentYear))
  const [deptF,    setDeptF]    = useState('All')
  const [loading,  setLoading]  = useState(false)
  const [leaveTypes, setLeaveTypes] = useState<RotaLeaveType[]>([])
  const [empLeave,   setEmpLeave]   = useState<Map<number, RotaLeave[]>>(new Map())
  const fetchedRef = useRef(false)

  const rotaEmps = useMemo(() => employees.filter(e => e.rotacloudId), [employees])
  const depts    = useMemo(() => [...new Set(employees.map(e => e.department ?? 'Unknown'))].sort(), [employees])

  useEffect(() => {
    if (rotaEmps.length === 0 || fetchedRef.current) return
    fetchedRef.current = true
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const types = await fetchRotaLeaveTypes().catch(() => [] as RotaLeaveType[])
        if (!cancelled) setLeaveTypes(types)
        const results = await Promise.allSettled(
          rotaEmps.map(e => fetchRotaLeave(e.rotacloudId!).then(l => ({ rotaId: e.rotacloudId!, leave: l })))
        )
        const m = new Map<number, RotaLeave[]>()
        results.forEach(r => { if (r.status === 'fulfilled') m.set(r.value.rotaId, r.value.leave) })
        if (!cancelled) setEmpLeave(m)
      } catch { /* no RotaCloud key */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [rotaEmps.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const empStats = useMemo(() => {
    return employees
      .filter(e => e.rotacloudId && (deptF === 'All' || e.department === deptF))
      .map(e => {
        const taken = (empLeave.get(e.rotacloudId!) ?? [])
          .filter(l => l.status === 'approved' && l.start_date.startsWith(yearF))
          .reduce((s, l) => s + l.days, 0)
        const annAlloc = e.leavePolicy?.annual?.total ?? 14
        return {
          name: e.name.split(' ')[0], fullName: e.name,
          dept: e.department ?? 'Unknown',
          taken, annAlloc,
          remaining: Math.max(0, annAlloc - taken),
          over: Math.max(0, taken - annAlloc),
        }
      })
  }, [employees, empLeave, yearF, deptF])

  const typeBreakdown = useMemo(() => {
    const m = new Map<number, number>()
    empLeave.forEach(leaves => {
      leaves.filter(l => l.status === 'approved' && l.start_date.startsWith(yearF))
        .forEach(l => { m.set(l.leave_type, (m.get(l.leave_type) ?? 0) + l.days) })
    })
    return [...m.entries()]
      .map(([tid, days], i) => ({ type: leaveTypes.find(t => t.id === tid)?.name ?? `Type ${tid}`, days, color: DC[i % DC.length] }))
      .sort((a, b) => b.days - a.days)
  }, [empLeave, leaveTypes, yearF])

  const monthlyTrend = useMemo(() => {
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((label, i) => {
      const prefix = `${yearF}-${String(i + 1).padStart(2, '0')}`
      let days = 0
      empLeave.forEach(leaves => {
        leaves.filter(l => l.status === 'approved' && l.start_date.startsWith(prefix)).forEach(l => { days += l.days })
      })
      return { month: label, days }
    })
  }, [empLeave, yearF])

  const totalDays = empStats.reduce((s, e) => s + e.taken, 0)
  const avgPerEmp = empStats.length > 0 ? (totalDays / empStats.length).toFixed(1) : '0'
  const over80    = empStats.filter(e => e.taken >= e.annAlloc * 0.8).length
  const zeroLeave = empStats.filter(e => e.taken === 0).length
  const exceeded  = empStats.filter(e => e.taken > e.annAlloc)
  const hasRota   = rotaEmps.length > 0
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].map(String)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">Leave Usage by Employee</h2>
        <p className="page-sub">{hasRota ? 'Leave taken vs allowance from RotaCloud' : 'Link RotaCloud IDs to employees to enable live data'}</p>
      </div>

      {!hasRota && <Insight type="warning">No RotaCloud IDs linked to employees. Add <strong>rotacloudId</strong> in employee profiles to enable live leave tracking.</Insight>}
      {loading && <div className="text-xs text-gray-400 py-6 text-center">Loading leave records…</div>}

      {hasRota && !loading && (
        <>
          <div className="flex gap-3 flex-wrap">
            <FilterSelect value={yearF} onChange={setYearF}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </FilterSelect>
            <FilterSelect value={deptF} onChange={setDeptF}>
              <option value="All">All Departments</option>
              {depts.map(d => <option key={d}>{d}</option>)}
            </FilterSelect>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Days Taken"   value={totalDays}  icon={Calendar}      color="#F59E0B" />
            <StatCard label="Avg Per Employee"   value={avgPerEmp}  icon={Activity}      color="#2E86C1" sub="days" />
            <StatCard label="Over 80% Allowance" value={over80}     icon={AlertTriangle} color="#F97316" sub="employees" />
            <StatCard label="Zero Leave Taken"   value={zeroLeave}  icon={AlertCircle}   color="#EF4444" sub="potential burnout" />
          </div>

          <div className="space-y-2">
            {zeroLeave > 0 && <Insight type="warning"><strong>{zeroLeave} employee{zeroLeave > 1 ? 's' : ''}</strong> {zeroLeave > 1 ? 'have' : 'has'} taken zero leave this year — potential burnout risk.</Insight>}
            {exceeded.length > 0 && <Insight type="danger"><strong>{exceeded.map(e => e.fullName).join(', ')}</strong> {exceeded.length > 1 ? 'have' : 'has'} exceeded their annual leave allowance.</Insight>}
            {totalDays === 0 && empLeave.size > 0 && <Insight type="info">No approved leave found for {yearF}. Records may still be pending approval in RotaCloud.</Insight>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5 lg:col-span-2">
              <SectionTitle>Annual Leave: Taken vs Remaining</SectionTitle>
              {empStats.length === 0
                ? <div className="h-40 flex items-center justify-center text-xs text-gray-400">No employees with RotaCloud IDs in this department</div>
                : <ResponsiveContainer width="100%" height={Math.max(160, empStats.length * 28)} className="mt-3">
                    <BarChart data={empStats} barSize={16} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={TT} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="taken"     stackId="a" fill="#2E86C1" name="Taken" />
                      <Bar dataKey="remaining" stackId="a" fill="#DBEAFE" name="Remaining" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="over"      fill="#EF4444" name="Over Allowance" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>

            <div className="card p-5">
              <SectionTitle>Leave Type Breakdown</SectionTitle>
              {typeBreakdown.length === 0
                ? <div className="h-40 flex items-center justify-center text-xs text-gray-400">No leave data for {yearF}</div>
                : <div className="flex items-center gap-4 mt-4">
                    <ResponsiveContainer width={130} height={130}>
                      <PieChart>
                        <Pie data={typeBreakdown.map(t => ({ name: t.type, value: t.days }))} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                          {typeBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip contentStyle={TT} formatter={v => [`${v} days`, '']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {typeBreakdown.map(t => (
                        <div key={t.type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                            <span className="text-xs text-gray-500">{t.type}</span>
                          </div>
                          <span className="text-xs font-semibold text-secondary">{t.days}d</span>
                        </div>
                      ))}
                    </div>
                  </div>
              }
            </div>

            <div className="card p-5">
              <SectionTitle>Leave Usage Trend — {yearF}</SectionTitle>
              <ResponsiveContainer width="100%" height={150} className="mt-3">
                <LineChart data={monthlyTrend} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TT} />
                  <Line type="monotone" dataKey="days" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3, fill: '#F59E0B' }} name="Days" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 4. TURNOVER REPORT
// ─────────────────────────────────────────────────────────────────────

function TurnoverReport({ employees }: { employees: FirebaseEmployee[] }) {
  const [deptF,   setDeptF]   = useState('All')
  const [reasonF, setReasonF] = useState('All')
  const [sortCol, setSortCol] = useState('')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc')

  const leavers = useMemo(() => employees
    .filter(e => ['resigned','terminated'].includes(e.status ?? ''))
    .map(e => {
      const start     = e.startDate         ? new Date(e.startDate)         : null
      const departure = e.statusChangedDate  ? new Date(e.statusChangedDate) : new Date()
      let los = '—'
      if (start) {
        const m = Math.floor((departure.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
        los = m < 12 ? `${m}m` : `${Math.floor(m/12)}y${m%12>0?` ${m%12}m`:''}`
      }
      return { name: e.name, dept: e.department ?? 'Unknown', reason: e.status === 'resigned' ? 'Resignation' : 'Dismissal', date: e.statusChangedDate ?? '—', dateRaw: e.statusChangedDate ?? '', los }
    })
    .sort((a, b) => b.dateRaw.localeCompare(a.dateRaw))
  , [employees])

  const deptBreakdown = useMemo(() => {
    const m: Record<string,number> = {}
    leavers.forEach(l => { m[l.dept] = (m[l.dept] ?? 0) + 1 })
    return Object.entries(m).map(([dept, n]) => ({ dept, leavers: n })).sort((a,b) => b.leavers - a.leavers)
  }, [leavers])

  const trendData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 12 }, (_, i) => {
      const td  = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      const ms  = `${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,'0')}`
      const cnt = leavers.filter(l => l.dateRaw.startsWith(ms)).length
      return { month: td.toLocaleDateString('en-GB', { month: 'short' }), rate: employees.length > 0 ? +(cnt/employees.length*100).toFixed(1) : 0, benchmark: 3 }
    })
  }, [leavers, employees.length])

  const reasonBreakdown = useMemo(() => [
    { name: 'Resignation', value: leavers.filter(l => l.reason === 'Resignation').length, color: '#F59E0B' },
    { name: 'Dismissal',   value: leavers.filter(l => l.reason === 'Dismissal').length,   color: '#EF4444' },
  ], [leavers])

  const avgLOS = useMemo(() => {
    const valid = employees.filter(e => ['resigned','terminated'].includes(e.status??'') && e.startDate && e.statusChangedDate)
    if (!valid.length) return '—'
    const total = valid.reduce((s,e) => s + Math.floor((new Date(e.statusChangedDate!).getTime()-new Date(e.startDate).getTime())/(1000*60*60*24*30.44)), 0)
    const avg   = Math.round(total / valid.length)
    return avg < 12 ? `${avg} months` : `${(avg/12).toFixed(1)} yrs`
  }, [employees])

  const totalLeavers = leavers.length
  const turnoverRate = employees.length > 0 ? (totalLeavers/employees.length*100).toFixed(1) : '0.0'
  const highToDepts  = deptBreakdown.filter(d => d.leavers > 2)
  const allDepts     = [...new Set(leavers.map(l => l.dept))]

  const filtered = leavers.filter(l => (deptF === 'All' || l.dept === deptF) && (reasonF === 'All' || l.reason === reasonF))

  const toggle  = (col: string) => { if (sortCol === col) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortCol(col); setSortDir('asc') } }
  const SortIco = ({ col }: { col: string }) => sortCol === col ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />) : null

  const sorted = useMemo(() => {
    if (!sortCol) return filtered
    const fn: Record<string,(l:typeof filtered[0])=>string> = { Name: l=>l.name, Department: l=>l.dept, Reason: l=>l.reason, Date: l=>l.dateRaw }
    const get = fn[sortCol] ?? ((l:typeof filtered[0]) => l.los)
    return [...filtered].sort((a,b) => sortDir==='asc' ? get(a).localeCompare(get(b)) : get(b).localeCompare(get(a)))
  }, [filtered, sortCol, sortDir])

  if (totalLeavers === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="page-header">Staff Turnover & Retention</h2>
          <p className="page-sub">Leavers, turnover rate, and retention analysis from Firebase</p>
        </div>
        <div className="card p-12 flex flex-col items-center gap-3 text-center">
          <UserX size={32} className="text-gray-200" />
          <p className="text-sm font-semibold text-gray-400">No leavers on record yet</p>
          <p className="text-xs text-gray-300 max-w-xs">When employees are marked as resigned or terminated, their turnover statistics will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">Staff Turnover & Retention</h2>
        <p className="page-sub">Leavers, turnover rate, and retention analysis from Firebase</p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <FilterSelect value={deptF} onChange={setDeptF}>
          <option value="All">All Departments</option>
          {allDepts.map(d => <option key={d}>{d}</option>)}
        </FilterSelect>
        <FilterSelect value={reasonF} onChange={setReasonF}>
          <option value="All">All Reasons</option>
          <option value="Resignation">Resignation</option>
          <option value="Dismissal">Dismissal</option>
        </FilterSelect>
        <button onClick={() => exportCSV('Turnover', ['Name','Department','Reason','Date','Length of Service'], sorted.map(l => [l.name,l.dept,l.reason,l.date,l.los]))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-50 ml-auto">
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Leavers"         value={totalLeavers}        icon={UserX}        color="#EC4899" />
        <StatCard label="Turnover Rate"          value={`${turnoverRate}%`}  icon={TrendingDown} color="#EF4444" />
        <StatCard label="Avg Length of Service"  value={avgLOS}              icon={Clock}        color="#F59E0B" sub="of leavers" />
        <StatCard label="Most Affected Dept"     value={deptBreakdown[0]?.dept ?? '—'} icon={AlertCircle} color="#8B5CF6" />
      </div>

      <div className="space-y-2">
        {highToDepts.map(d => <Insight key={d.dept} type="warning"><strong>{d.dept}</strong> had <strong>{d.leavers}</strong> leavers — more than 2 in the period.</Insight>)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 lg:col-span-2">
          <SectionTitle>Monthly Turnover Rate vs Industry Benchmark</SectionTitle>
          <ResponsiveContainer width="100%" height={180} className="mt-3">
            <LineChart data={trendData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, 'auto']} />
              <Tooltip contentStyle={TT} formatter={(v,n) => [`${v}%`, n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="rate"      stroke="#EC4899" strokeWidth={2} dot={{ r: 3, fill: '#EC4899' }} name="Turnover Rate" />
              <Line type="monotone" dataKey="benchmark" stroke="#94A3B8" strokeWidth={1} strokeDasharray="6 3" dot={false} name="Benchmark (3%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <SectionTitle>Turnover by Department</SectionTitle>
          <ResponsiveContainer width="100%" height={180} className="mt-3">
            <BarChart layout="vertical" data={deptBreakdown} barSize={12} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={88} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="leavers" fill="#EC4899" radius={[0, 4, 4, 0]} name="Leavers" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <SectionTitle>Reasons for Leaving</SectionTitle>
          <div className="flex items-center gap-4 mt-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={reasonBreakdown.filter(r => r.value > 0)} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                  {reasonBreakdown.filter(r => r.value > 0).map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={TT} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {reasonBreakdown.map(r => (
                <div key={r.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-xs text-gray-500">{r.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-secondary">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <SectionTitle>Leavers Register</SectionTitle>
          <p className="text-xs text-gray-400">{sorted.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                {['Name','Department','Reason','Date','Length of Service'].map(h => (
                  <th key={h} onClick={() => toggle(h)} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-gray-600 select-none">
                    <span className="flex items-center gap-1">{h} <SortIco col={h} /></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.length === 0
                ? <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">No records match your filters.</td></tr>
                : sorted.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50/40">
                    <td className="px-4 py-2.5 text-xs font-semibold text-secondary">{l.name}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{l.dept}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', l.reason === 'Resignation' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700')}>{l.reason}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{l.date}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{l.los}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 5. PERFORMANCE REPORT
// ─────────────────────────────────────────────────────────────────────

const PERF_DIST = [
  { range: '1–2', count: 2 }, { range: '2–3', count: 7 },  { range: '3–4', count: 15 },
  { range: '4–5', count: 12 }, { range: '5–6', count: 8 }, { range: '6–7', count: 5  },
  { range: '7–8', count: 3 }, { range: '8–10', count: 2 },
]

const PERF_BY_DEPT = [
  { dept: 'Management', avg: 7.8 }, { dept: 'IT',      avg: 7.1 }, { dept: 'Finance', avg: 6.9 },
  { dept: 'HR',         avg: 6.8 }, { dept: 'QA',      avg: 6.2 }, { dept: 'Admin',   avg: 5.9 },
  { dept: 'Operations', avg: 5.4 }, { dept: 'Dispatch', avg: 5.1 }, { dept: 'Customer Service', avg: 4.8 },
]

const PERF_TREND = [
  { cycle: 'Q1 24', avg: 5.6 }, { cycle: 'Q2 24', avg: 5.9 },
  { cycle: 'Q3 24', avg: 6.1 }, { cycle: 'Q4 24', avg: 6.4 },
]

const TOP5    = [{ name: 'Aisha Tariq', dept: 'Management', score: 9.2 }, { name: 'Usman Ali', dept: 'IT', score: 8.8 }, { name: 'Hamza Qureshi', dept: 'Finance', score: 8.5 }, { name: 'Fatima Malik', dept: 'HR', score: 8.3 }, { name: 'Nadia Iqbal', dept: 'QA', score: 8.0 }]
const BOTTOM5 = [{ name: 'Waqas Ashraf', dept: 'Dispatch', score: 2.4 }, { name: 'Omar Sheikh', dept: 'Operations', score: 3.1 }, { name: 'Danial Raza', dept: 'Customer Service', score: 3.3 }, { name: 'Bilal Ahmed', dept: 'Dispatch', score: 3.5 }, { name: 'Kashif Nawaz', dept: 'Operations', score: 3.8 }]

function PerformanceReport() {
  const [deptF, setDeptF] = useState('All')
  const COMPANY_AVG = 6.2
  const belowAvg = PERF_BY_DEPT.filter(d => d.avg < COMPANY_AVG)
  const displayDepts = deptF === 'All' ? PERF_BY_DEPT : PERF_BY_DEPT.filter(d => d.dept === deptF)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">Employee Performance Overview</h2>
        <p className="page-sub">Review scores, distribution, and department benchmarks · Mock data</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <FilterSelect value={deptF} onChange={setDeptF}>
          <option value="All">All Departments</option>
          {PERF_BY_DEPT.map(d => <option key={d.dept}>{d.dept}</option>)}
        </FilterSelect>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Company Avg Score"    value={`${COMPANY_AVG}/10`} icon={Star}          color="#8B5CF6" />
        <StatCard label="High Performers"      value="18%"                  icon={Award}         color="#10B981" sub="score ≥ 8" />
        <StatCard label="On PIP"               value="8%"                   icon={AlertTriangle} color="#EF4444" sub="improvement plan" />
        <StatCard label="Review Completion"    value="87%"                  icon={CheckCircle}   color="#2E86C1" />
      </div>

      <div className="space-y-2">
        {belowAvg.slice(0, 3).map(d => (
          <Insight key={d.dept} type="warning"><strong>{d.dept}</strong> is averaging <strong>{d.avg}/10</strong> — below the company average of {COMPANY_AVG}.</Insight>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <SectionTitle>Score Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={180} className="mt-3">
            <BarChart data={PERF_DIST} barSize={28} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="range" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="count" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Employees" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <SectionTitle>Avg Score by Department</SectionTitle>
          <ResponsiveContainer width="100%" height={200} className="mt-3">
            <BarChart layout="vertical" data={displayDepts} barSize={12} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 10]} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={88} />
              <Tooltip contentStyle={TT} formatter={v => [`${v}/10`, 'Avg']} />
              <Bar dataKey="avg" radius={[0, 4, 4, 0]} name="Avg Score">
                {displayDepts.map((d, i) => <Cell key={i} fill={d.avg >= COMPANY_AVG ? '#8B5CF6' : '#F59E0B'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <SectionTitle>Avg Score Trend — Review Cycles</SectionTitle>
          <ResponsiveContainer width="100%" height={150} className="mt-3">
            <LineChart data={PERF_TREND} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="cycle" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[4, 10]} />
              <Tooltip contentStyle={TT} formatter={v => [`${v}/10`, 'Avg']} />
              <Line type="monotone" dataKey="avg" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4, fill: '#8B5CF6' }} name="Avg Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">Top 5 Performers</p>
            <div className="space-y-2">
              {TOP5.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div><p className="text-xs font-semibold text-secondary leading-none">{p.name}</p><p className="text-[10px] text-gray-400">{p.dept}</p></div>
                  </div>
                  <span className="text-sm font-bold text-green-600">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">Bottom 5 Performers</p>
            <div className="space-y-2">
              {BOTTOM5.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div><p className="text-xs font-semibold text-secondary leading-none">{p.name}</p><p className="text-[10px] text-gray-400">{p.dept}</p></div>
                  </div>
                  <span className="text-sm font-bold text-red-500">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 6. TRAINING COMPLIANCE REPORT
// ─────────────────────────────────────────────────────────────────────

const TRAIN_DEPTS = [
  { dept: 'HR',          rate: 95 }, { dept: 'Finance',    rate: 92 }, { dept: 'IT',         rate: 90 },
  { dept: 'Management',  rate: 88 }, { dept: 'Admin',      rate: 82 }, { dept: 'QA',          rate: 78 },
  { dept: 'Dispatch',    rate: 71 }, { dept: 'Operations', rate: 63 }, { dept: 'Customer Service', rate: 58 },
]

const TRAIN_TREND = [
  { month: 'Nov', completions: 8 }, { month: 'Dec', completions: 12 }, { month: 'Jan', completions: 6 },
  { month: 'Feb', completions: 15 }, { month: 'Mar', completions: 10 }, { month: 'Apr', completions: 11 },
]

const TRAIN_TABLE = [
  { name: 'Ahmed Raza',    dept: 'Operations', health: 'Overdue',      safeguard: 'Complete',    data: 'Overdue',      fire: 'Complete'    },
  { name: 'Sara Khan',     dept: 'HR',         health: 'Complete',     safeguard: 'Complete',    data: 'Complete',     fire: 'Complete'    },
  { name: 'Bilal Ahmed',   dept: 'Dispatch',   health: 'In Progress',  safeguard: 'Overdue',     data: 'Complete',     fire: 'Overdue'     },
  { name: 'Fatima Malik',  dept: 'Finance',    health: 'Complete',     safeguard: 'Complete',    data: 'Complete',     fire: 'Complete'    },
  { name: 'Usman Ali',     dept: 'IT',         health: 'Complete',     safeguard: 'Complete',    data: 'In Progress',  fire: 'Complete'    },
  { name: 'Omar Sheikh',   dept: 'Operations', health: 'Overdue',      safeguard: 'Overdue',     data: 'Overdue',      fire: 'Overdue'     },
  { name: 'Nadia Iqbal',   dept: 'Dispatch',   health: 'In Progress',  safeguard: 'Complete',    data: 'Overdue',      fire: 'In Progress' },
]

function TrainingReport() {
  const [deptF, setDeptF] = useState('All')

  const OVERALL = 78
  const r = 54, circ = 2 * Math.PI * r, dash = (OVERALL / 100) * circ
  const belowThreshold = TRAIN_DEPTS.filter(d => d.rate < 80)
  const overdueNames   = TRAIN_TABLE.filter(t => [t.health, t.safeguard, t.data, t.fire].includes('Overdue')).map(t => t.name)
  const filtered       = deptF === 'All' ? TRAIN_TABLE : TRAIN_TABLE.filter(t => t.dept === deptF)

  const statusColor = (s: string) =>
    s === 'Complete' ? 'bg-green-100 text-green-700' : s === 'In Progress' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">Mandatory Training Compliance</h2>
        <p className="page-sub">Course completion status and compliance rates by department · Mock data</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <FilterSelect value={deptF} onChange={setDeptF}>
          <option value="All">All Departments</option>
          {TRAIN_DEPTS.map(d => <option key={d.dept}>{d.dept}</option>)}
        </FilterSelect>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Overall Compliance"     value={`${OVERALL}%`} icon={CheckCircle}   color="#10B981" />
        <StatCard label="Fully Compliant"        value={24}             icon={Award}         color="#2E86C1" sub="employees" />
        <StatCard label="Overdue Training"       value={12}             icon={AlertTriangle} color="#EF4444" sub="employees" />
        <StatCard label="Completed This Month"   value={11}             icon={BookOpen}      color="#8B5CF6" sub="sessions" />
      </div>

      <div className="space-y-2">
        {belowThreshold.map(d => <Insight key={d.dept} type="danger"><strong>{d.dept}</strong> compliance is <strong>{d.rate}%</strong> — below the 80% required threshold.</Insight>)}
        {overdueNames.length > 0 && <Insight type="warning">Employees with overdue mandatory training: <strong>{overdueNames.join(', ')}</strong>.</Insight>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col items-center justify-center">
          <SectionTitle>Overall Compliance</SectionTitle>
          <div className="relative mt-4">
            <svg width={130} height={130} viewBox="0 0 130 130">
              <circle cx={65} cy={65} r={r} fill="none" stroke="#F0F4F8" strokeWidth={12} />
              <circle cx={65} cy={65} r={r} fill="none" stroke={OVERALL >= 80 ? '#10B981' : '#EF4444'}
                strokeWidth={12} strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 65 65)" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-secondary">{OVERALL}%</span>
              <span className="text-[10px] text-gray-400">Compliance</span>
            </div>
          </div>
        </div>

        <div className="card p-5 lg:col-span-2">
          <SectionTitle>Compliance Rate by Department</SectionTitle>
          <ResponsiveContainer width="100%" height={200} className="mt-3">
            <BarChart layout="vertical" data={TRAIN_DEPTS} barSize={12} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" domain={[0, 100]} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={88} />
              <Tooltip contentStyle={TT} formatter={v => [`${v}%`, 'Compliance']} />
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} name="Compliance %">
                {TRAIN_DEPTS.map((d, i) => <Cell key={i} fill={d.rate >= 80 ? '#10B981' : '#EF4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5 lg:col-span-3">
          <SectionTitle>Training Completions — Last 6 Months</SectionTitle>
          <ResponsiveContainer width="100%" height={140} className="mt-3">
            <BarChart data={TRAIN_TREND} barSize={32} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TT} />
              <Bar dataKey="completions" fill="#10B981" radius={[4, 4, 0, 0]} name="Completions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SectionTitle>Employee Training Status per Course</SectionTitle></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                {['Employee','Department','Health & Safety','Safeguarding','Data Protection','Fire Safety'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((t, i) => (
                <tr key={i} className="hover:bg-gray-50/40">
                  <td className="px-4 py-2.5 text-xs font-semibold text-secondary">{t.name}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{t.dept}</td>
                  {[t.health, t.safeguard, t.data, t.fire].map((s, j) => (
                    <td key={j} className="px-4 py-2.5">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', statusColor(s))}>{s}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 7. PAYROLL SUMMARY REPORT
// ─────────────────────────────────────────────────────────────────────

function PayrollReport({ employees, runs }: { employees: FirebaseEmployee[]; runs: ReturnType<typeof useFirebasePayroll>['runs'] }) {
  const [runId, setRunId] = useState(runs[0]?.id ?? '')
  const selectedRun = runs.find(r => r.id === runId) ?? runs[0]

  const deptCost = useMemo(() => {
    const m: Record<string, { dept: string; headcount: number; totalCost: number }> = {}
    employees.forEach(e => {
      const d = e.department ?? 'Unknown'
      if (!m[d]) m[d] = { dept: d, headcount: 0, totalCost: 0 }
      m[d].headcount++
      m[d].totalCost += e.salary ?? (e.hourlyRate ? e.hourlyRate * (e.monthlyHours ?? 160) : 0)
    })
    return Object.values(m).sort((a, b) => b.totalCost - a.totalCost)
  }, [employees])

  const payrollTrend = useMemo(() =>
    [...runs].sort((a, b) => a.month.localeCompare(b.month)).slice(-12).map(r => ({
      month: new Date(r.month + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      net: r.totalNet,
    }))
  , [runs])

  const donutData = useMemo(() => deptCost.slice(0, 6).map((d, i) => ({
    name: d.dept,
    value: d.totalCost > 0 ? d.totalCost : Math.round((selectedRun?.totalGross ?? 0) * ([0.32, 0.22, 0.16, 0.12, 0.10, 0.08][i] ?? 0)),
    color: DC[i],
  })), [deptCost, selectedRun])

  const totalMonthly = selectedRun?.totalGross ?? 0
  const avgSalary    = employees.length > 0 ? Math.round(totalMonthly / employees.length) : 0
  const highestDept  = deptCost[0]?.dept ?? '—'
  const lastTwo      = payrollTrend.slice(-2)
  const momNum       = lastTwo.length === 2 && lastTwo[0].net > 0 ? ((lastTwo[1].net - lastTwo[0].net) / lastTwo[0].net * 100) : 0
  const highMoM      = payrollTrend.length >= 2 && Math.abs(momNum) > 10

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">Payroll Cost Analysis</h2>
        <p className="page-sub">Salary costs aggregated by department from payroll runs</p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        {runs.length > 0 ? (
          <FilterSelect value={runId} onChange={setRunId}>
            {runs.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </FilterSelect>
        ) : (
          <p className="text-xs text-gray-400 italic">No payroll runs yet — run a payroll cycle to see data here.</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Monthly Cost"  value={fmtPKR(totalMonthly)} icon={Banknote}     color="#059669" />
        <StatCard label="Average Salary"      value={fmtPKR(avgSalary)}    icon={Activity}     color="#2E86C1" sub="per employee" />
        <StatCard label="Highest Cost Dept"   value={highestDept}           icon={AlertCircle}  color="#F97316" />
        <StatCard label="Month-on-Month"      value={`${momNum > 0 ? '+' : ''}${momNum.toFixed(1)}%`} icon={TrendingDown} color={momNum > 0 ? '#EF4444' : '#10B981'} />
      </div>

      <div className="space-y-2">
        {highMoM && <Insight type="warning">Payroll cost changed by <strong>{momNum.toFixed(1)}%</strong> month-on-month — exceeds the 10% threshold.</Insight>}
        {deptCost[0]?.headcount > 0 && (
          <Insight type="info"><strong>{deptCost[0].dept}</strong> has the highest cost per head at <strong>{fmtPKR(Math.round(deptCost[0].totalCost / deptCost[0].headcount))}</strong> per employee.</Insight>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 lg:col-span-2">
          <SectionTitle>Total Salary Cost by Department</SectionTitle>
          {deptCost.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">No salary data — add salary/hourly rates to employee profiles</div>
          ) : (
            <ResponsiveContainer width="100%" height={180} className="mt-3">
              <BarChart layout="vertical" data={deptCost.slice(0, 8)} barSize={14} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="dept" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={88} />
                <Tooltip contentStyle={TT} formatter={v => [fmtPKR(v as number), 'Cost']} />
                <Bar dataKey="totalCost" fill="#059669" radius={[0, 4, 4, 0]} name="Total Cost" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <SectionTitle>Payroll Cost Trend — 12 Months</SectionTitle>
          {payrollTrend.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">No payroll runs yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160} className="mt-3">
              <LineChart data={payrollTrend} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={TT} formatter={v => [fmtPKR(v as number), 'Net Pay']} />
                <Line type="monotone" dataKey="net" stroke="#059669" strokeWidth={2} dot={{ r: 3, fill: '#059669' }} name="Net Pay" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <SectionTitle>Cost Proportion by Department</SectionTitle>
          <div className="flex items-center gap-4 mt-4">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={donutData} innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={3}>
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={v => [fmtPKR(v as number), '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 flex-1">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-gray-500 truncate max-w-[80px]">{d.name}</span>
                  </div>
                  <span className="text-[10px] font-semibold text-secondary">{fmtPKR(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SectionTitle>Department Cost Summary</SectionTitle></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                {['Department','Headcount','Total Cost','Avg per Head'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deptCost.map((d, i) => (
                <tr key={i} className="hover:bg-gray-50/40">
                  <td className="px-4 py-2.5 text-xs font-semibold text-secondary">{d.dept}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{d.headcount}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{fmtPKR(d.totalCost)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{d.headcount > 0 ? fmtPKR(Math.round(d.totalCost / d.headcount)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// 8. AUDIT TRAIL REPORT
// ─────────────────────────────────────────────────────────────────────

type ActionType = 'Created' | 'Updated' | 'Deleted' | 'Viewed' | 'Exported'

const AUDIT_LOG: { timestamp: string; user: string; action: ActionType; record: string; name: string; ip: string }[] = [
  { timestamp: '2025-04-29 09:42', user: 'Admin',    action: 'Updated',  record: 'Employee', name: 'Ahmed Raza',      ip: '192.168.1.10' },
  { timestamp: '2025-04-29 09:38', user: 'HR Mgr',   action: 'Created',  record: 'Leave',    name: 'Sara Khan',       ip: '192.168.1.11' },
  { timestamp: '2025-04-29 09:21', user: 'Admin',    action: 'Exported', record: 'Payroll',  name: 'April 2025 Run',  ip: '192.168.1.10' },
  { timestamp: '2025-04-29 08:55', user: 'HR Mgr',   action: 'Viewed',   record: 'Document', name: 'Bilal Ahmed',     ip: '192.168.1.11' },
  { timestamp: '2025-04-28 17:30', user: 'Admin',    action: 'Deleted',  record: 'Review',   name: 'Q1 2024 Review',  ip: '192.168.1.10' },
  { timestamp: '2025-04-28 16:15', user: 'Team Lead', action: 'Viewed',  record: 'Employee', name: 'Fatima Malik',    ip: '192.168.1.15' },
  { timestamp: '2025-04-28 15:45', user: 'HR Mgr',   action: 'Updated',  record: 'Employee', name: 'Usman Ali',       ip: '192.168.1.11' },
  { timestamp: '2025-04-28 14:20', user: 'Admin',    action: 'Created',  record: 'Employee', name: 'New Hire',        ip: '192.168.1.10' },
  { timestamp: '2025-04-28 13:10', user: 'HR Mgr',   action: 'Viewed',   record: 'Leave',    name: 'Zara Hussain',    ip: '192.168.1.11' },
  { timestamp: '2025-04-28 11:00', user: 'Admin',    action: 'Updated',  record: 'Payroll',  name: 'March 2025 Run',  ip: '192.168.1.10' },
  { timestamp: '2025-04-27 16:45', user: 'Team Lead', action: 'Viewed',  record: 'Employee', name: 'Omar Sheikh',     ip: '192.168.1.15' },
  { timestamp: '2025-04-27 15:30', user: 'HR Mgr',   action: 'Created',  record: 'Document', name: 'Policy Update',   ip: '192.168.1.11' },
  { timestamp: '2025-04-27 10:20', user: 'Admin',    action: 'Exported', record: 'Employee', name: 'Headcount Export', ip: '192.168.1.10' },
  { timestamp: '2025-04-26 17:00', user: 'HR Mgr',   action: 'Updated',  record: 'Review',   name: 'Nadia Iqbal',     ip: '192.168.1.11' },
  { timestamp: '2025-04-26 09:15', user: 'Admin',    action: 'Deleted',  record: 'Employee', name: 'Old Record',      ip: '192.168.1.10' },
]

const ACTION_STYLE: Record<ActionType, string> = {
  Created:  'bg-green-100  text-green-700',
  Updated:  'bg-blue-100   text-blue-700',
  Deleted:  'bg-red-100    text-red-700',
  Viewed:   'bg-gray-100   text-gray-600',
  Exported: 'bg-purple-100 text-purple-700',
}

const DAILY_ACTIONS = [
  { day: 'Mon 23', count: 12 }, { day: 'Tue 24', count: 8 }, { day: 'Wed 25', count: 15 },
  { day: 'Thu 26', count: 6 },  { day: 'Fri 27', count: 9 }, { day: 'Sat 28', count: 4 },
  { day: 'Sun 29', count: 11 },
]

function AuditReport() {
  const [search,    setSearch]    = useState('')
  const [actionF,   setActionF]   = useState('All')
  const [dateF,     setDateF]     = useState('All')

  const unusual  = DAILY_ACTIONS.filter(d => d.count > 10)
  const filtered = AUDIT_LOG.filter(a => {
    const q = search.toLowerCase()
    if (q && !a.user.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) return false
    if (actionF !== 'All' && a.action !== actionF) return false
    if (dateF   !== 'All' && !a.timestamp.startsWith(dateF)) return false
    return true
  })

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-header">System Activity Log</h2>
        <p className="page-sub">Complete audit trail of all system actions · Mock data</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Actions Today"      value={AUDIT_LOG.filter(a => a.timestamp.startsWith('2025-04-29')).length} icon={Activity}  color="#6B7280" />
        <StatCard label="Most Active User"   value="Admin"    icon={Users}     color="#2E86C1" />
        <StatCard label="Most Accessed Type" value="Employee" icon={FileText}  color="#8B5CF6" sub="record type" />
        <StatCard label="Actions (7 Days)"   value={AUDIT_LOG.length}          icon={Clock}     color="#10B981" />
      </div>

      {unusual.length > 0 && (
        <div className="space-y-2">
          {unusual.map(d => <Insight key={d.day} type="warning"><strong>{d.count} actions</strong> recorded on <strong>{d.day}</strong> — unusual activity (threshold: 10 actions/day).</Insight>)}
        </div>
      )}

      <div className="card p-5">
        <SectionTitle>Actions Per Day — Last 7 Days</SectionTitle>
        <ResponsiveContainer width="100%" height={140} className="mt-3">
          <BarChart data={DAILY_ACTIONS} barSize={32} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TT} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Actions">
              {DAILY_ACTIONS.map((d, i) => <Cell key={i} fill={d.count > 10 ? '#EF4444' : '#6B7280'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="Search user or record…" value={search} onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <FilterSelect value={actionF} onChange={setActionF}>
          <option value="All">All Actions</option>
          {(['Created','Updated','Deleted','Viewed','Exported'] as ActionType[]).map(a => <option key={a}>{a}</option>)}
        </FilterSelect>
        <FilterSelect value={dateF} onChange={setDateF}>
          <option value="All">All Dates</option>
          <option value="2025-04-29">Today</option>
          <option value="2025-04-28">Yesterday</option>
          <option value="2025-04-27">2 days ago</option>
          <option value="2025-04-26">3 days ago</option>
        </FilterSelect>
        <button onClick={() => exportCSV('Audit_Trail', ['Timestamp','User','Action','Record Type','Record Name','IP'],
          filtered.map(a => [a.timestamp, a.user, a.action, a.record, a.name, a.ip]))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-50 transition ml-auto">
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <SectionTitle>Activity Log</SectionTitle>
          <p className="text-xs text-gray-400">{filtered.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                {['Timestamp','User','Action','Record Type','Record Name','IP Address'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((a, i) => (
                <tr key={i} className="hover:bg-gray-50/40">
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">{a.timestamp}</td>
                  <td className="px-4 py-2.5 text-xs font-semibold text-secondary">{a.user}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', ACTION_STYLE[a.action])}>{a.action}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{a.record}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{a.name}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">{a.ip}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">No records match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// MAIN REPORTS PAGE
// ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'headcount',   label: 'Headcount',   Icon: Users        },
  { id: 'absenteeism', label: 'Absenteeism', Icon: AlertCircle  },
  { id: 'leave',       label: 'Leave Usage', Icon: Calendar     },
  { id: 'turnover',    label: 'Turnover',    Icon: TrendingDown },
  { id: 'performance', label: 'Performance', Icon: Star         },
  { id: 'training',    label: 'Training',    Icon: BookOpen     },
  { id: 'payroll',     label: 'Payroll',     Icon: Banknote     },
  { id: 'audit',       label: 'Audit Trail', Icon: Shield       },
] as const

type TabId = typeof TABS[number]['id']

export default function Reports() {
  const [tab, setTab]      = useState<TabId>('headcount')
  const { employees }      = useFirebaseEmployees()
  const { runs }           = useFirebasePayroll()

  return (
    <div className="space-y-4">
      <div>
        <h2 className="page-header">Reports & Analytics</h2>
        <p className="page-sub">Live data from Firebase · Mock data for RotaCloud-dependent reports</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-0.5 overflow-x-auto border-b border-gray-200 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all shrink-0 border-b-2 -mb-px rounded-t-lg',
              tab === t.id
                ? 'text-primary border-primary bg-primary/5'
                : 'text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50',
            )}>
            <t.Icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* Active report */}
      <div className="pt-1">
        {tab === 'headcount'   && <HeadcountReport   employees={employees} />}
        {tab === 'absenteeism' && <AbsenteeismReport employees={employees} />}
        {tab === 'leave'       && <LeaveUsageReport  employees={employees} />}
        {tab === 'turnover'    && <TurnoverReport     employees={employees} />}
        {tab === 'performance' && <PerformanceReport />}
        {tab === 'training'    && <TrainingReport />}
        {tab === 'payroll'     && <PayrollReport      employees={employees} runs={runs} />}
        {tab === 'audit'       && <AuditReport />}
      </div>
    </div>
  )
}
