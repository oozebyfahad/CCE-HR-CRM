import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { useAppSelector } from '../../store'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import { fetchRotaAttendance, monthToUnix, type RotaAttendance } from '../../services/rotacloud'
import { unixToLocalDate, unixToHHMM } from '../../hooks/useRotaAttendance'
import { fmt12, fmtHours, toYMD } from '../../hooks/useFirebaseTimesheets'

// ── Main page ─────────────────────────────────────────────────────────

export default function MyAttendance() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employees } = useFirebaseEmployees()
  const myEmployee    = employees.find(e => e.email === currentUser?.email)

  const today      = new Date()
  const todayYMD   = toYMD(today)
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selDay,   setSelDay]   = useState<string | null>(todayYMD)

  // RotaCloud data for displayed month
  const [rotaRecords,  setRotaRecords]  = useState<RotaAttendance[]>([])
  const [rotaLoading,  setRotaLoading]  = useState(false)

  const year      = viewDate.getFullYear()
  const month     = viewDate.getMonth()
  const monthName = viewDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const monthStr  = `${year}-${String(month + 1).padStart(2, '0')}`

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  useEffect(() => {
    if (!myEmployee?.rotacloudId) return
    setRotaLoading(true)
    const { start, end } = monthToUnix(monthStr)
    fetchRotaAttendance(start, end)
      .then(recs => {
        setRotaRecords(
          recs.filter(r => !r.deleted && r.user === Number(myEmployee.rotacloudId))
        )
        setRotaLoading(false)
      })
      .catch(() => setRotaLoading(false))
  }, [monthStr, myEmployee?.rotacloudId])

  // Index by date
  const rotaByDate = new Map<string, RotaAttendance>()
  for (const r of rotaRecords) {
    const dateStr = unixToLocalDate(r.in_time)
    const existing = rotaByDate.get(dateStr)
    if (!existing || r.approved) rotaByDate.set(dateStr, r)
  }

  const daysInMo = new Date(year, month + 1, 0).getDate()
  const startDay = new Date(year, month, 1).getDay()

  // Build per-day status from RotaCloud
  const dayStatus = new Map<string, 'present' | 'late' | 'absent' | 'weekend' | 'clocked_in'>()
  for (let d = 1; d <= daysInMo; d++) {
    const date    = new Date(year, month, d)
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow     = date.getDay()
    if (dow === 0 || dow === 6) { dayStatus.set(dateStr, 'weekend'); continue }
    if (date > today) continue

    const rec = rotaByDate.get(dateStr)
    if (!rec) {
      if (dateStr < todayYMD) dayStatus.set(dateStr, 'absent')
      continue
    }
    if (rec.in_time_clocked && !rec.out_time_clocked) {
      dayStatus.set(dateStr, 'clocked_in')
    } else if (rec.hours > 0) {
      dayStatus.set(dateStr, rec.minutes_late > 30 ? 'late' : 'present')
    }
  }

  // Monthly stats
  let present = 0, late = 0, absent = 0, totalHours = 0
  dayStatus.forEach(s => {
    if (s === 'present' || s === 'clocked_in') present++
    else if (s === 'late')   late++
    else if (s === 'absent') absent++
  })
  rotaByDate.forEach(r => { totalHours += r.hours })

  const workDays      = present + late + absent
  const attendancePct = workDays > 0 ? Math.round(((present + late) / workDays) * 100) : 100

  // Selected day detail
  const selRec = selDay ? rotaByDate.get(selDay) : undefined

  // 4-week bar chart (hours from RotaCloud)
  const weekData = Array.from({ length: 4 }, (_, w) => {
    const ws = new Date(today)
    ws.setDate(today.getDate() - (3 - w) * 7 - (today.getDay() || 7) + 1)
    let hrs = 0
    for (let d = 0; d < 5; d++) {
      const dd = new Date(ws)
      dd.setDate(ws.getDate() + d)
      const dateStr = toYMD(dd)
      hrs += rotaByDate.get(dateStr)?.hours ?? 0
    }
    return { week: `W${w + 1}`, hours: Math.round(hrs * 10) / 10 }
  })

  const DAY_HEADS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  const dayClass = (status: string | undefined, isToday: boolean, isSel: boolean) => {
    const base = `aspect-square text-[11px] rounded-lg flex items-center justify-center transition-all ${isSel ? 'ring-2 ring-primary ring-offset-1' : ''} ${isToday ? 'ring-1 ring-primary/50' : ''}`
    if (status === 'present' || status === 'clocked_in') return `${base} bg-green-100 text-green-700 hover:bg-green-200 cursor-pointer`
    if (status === 'late')    return `${base} bg-amber-100 text-amber-700 hover:bg-amber-200 cursor-pointer`
    if (status === 'absent')  return `${base} bg-red-100   text-red-700   hover:bg-red-200   cursor-pointer`
    if (status === 'weekend') return `${base} text-gray-200 cursor-default`
    return `${base} text-gray-500 hover:bg-gray-100 cursor-pointer`
  }

  return (
    <div className="space-y-5">

      <div>
        <h1 className="text-xl font-bold text-secondary">My Attendance</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your attendance history via RotaCloud</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { l: 'Attendance Rate', v: `${attendancePct}%`,  c: 'text-green-600', sub: `${present + late}/${workDays} days`, bg: 'bg-green-50' },
          { l: 'Present Days',    v: present,               c: 'text-green-700', sub: 'this month',                         bg: 'bg-green-50' },
          { l: 'Late Arrivals',   v: late,                  c: 'text-amber-700', sub: 'this month',                         bg: 'bg-amber-50' },
          { l: 'Hours Worked',    v: fmtHours(totalHours),  c: 'text-primary',   sub: 'this month',                         bg: 'bg-blue-50'  },
        ].map(s => (
          <div key={s.l} className={`card p-4 ${s.bg}`}>
            <p className="text-xs text-gray-500 font-medium">{s.l}</p>
            <p className={`text-2xl font-bold mt-1 ${s.c} tabular-nums`}>{s.v}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Calendar */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-secondary">{monthName}</p>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500">
                <ChevronLeft size={14} />
              </button>
              <button onClick={nextMonth}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {rotaLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-gray-400 text-sm">
              <Clock size={14} className="animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_HEADS.map(d => (
                  <span key={d} className="text-[10px] text-gray-400 font-semibold text-center py-1">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array(startDay).fill(null).map((_, i) => <span key={`e${i}`} />)}
                {Array.from({ length: daysInMo }, (_, i) => {
                  const d       = i + 1
                  const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const status  = dayStatus.get(dateStr)
                  const isToday = dateStr === todayYMD
                  const isSel   = dateStr === selDay
                  return (
                    <button key={d}
                      onClick={() => status !== 'weekend' && setSelDay(dateStr)}
                      className={dayClass(status, isToday, isSel)}>
                      {d}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <div className="flex gap-4 mt-4 flex-wrap">
            {[
              { l: 'Present', c: 'bg-green-200' },
              { l: 'Late',    c: 'bg-amber-200' },
              { l: 'Absent',  c: 'bg-red-200'   },
              { l: 'No data', c: 'bg-gray-100'  },
            ].map(s => (
              <div key={s.l} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded ${s.c}`} />
                <span className="text-[10px] text-gray-500">{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Selected day detail */}
          <div className="card p-5 flex-1">
            <p className="text-sm font-bold text-secondary mb-3">
              {selDay
                ? (() => {
                    const [y, m, d] = selDay.split('-').map(Number)
                    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
                  })()
                : 'Select a day'}
            </p>

            {!selRec ? (
              <p className="text-xs text-gray-400">No RotaCloud record for this day.</p>
            ) : (
              <div className="space-y-3">
                {/* Clock times */}
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <div>
                    <p className="text-xs font-semibold text-secondary">
                      {selRec.in_time_clocked && !selRec.out_time_clocked
                        ? 'Clocked in — still active'
                        : selRec.in_time_clocked && selRec.out_time_clocked
                          ? `${fmt12(unixToHHMM(selRec.in_time_clocked))} → ${fmt12(unixToHHMM(selRec.out_time_clocked))}`
                          : 'No clock times recorded'}
                    </p>
                    {selRec.minutes_late > 0 && (
                      <p className="text-[10px] text-amber-600 mt-0.5">{selRec.minutes_late} minutes late</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-primary tabular-nums">
                    {selRec.in_time_clocked && !selRec.out_time_clocked
                      ? 'Live'
                      : fmtHours(selRec.hours)}
                  </span>
                </div>

                {/* Approved badge */}
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selRec.approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {selRec.approved ? 'Approved' : 'Pending approval'}
                  </span>
                  {selRec.minutes_break > 0 && (
                    <span className="text-[10px] text-gray-400">{selRec.minutes_break}m break</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4-week chart */}
          <div className="card p-5">
            <p className="text-sm font-bold text-secondary mb-3">4-Week Hours</p>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={weekData} margin={{ top: 0, right: 0, bottom: 0, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                  formatter={(v: number) => [`${v}h`, 'Hours']}
                />
                <Bar dataKey="hours" fill="#2E86C1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
