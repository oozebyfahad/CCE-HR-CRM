import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Download, FileText } from 'lucide-react'
import { headcountTrend, departmentData, weeklyAttendance, employmentTypeData } from '../../utils/mockData'

const TURNOVER = [
  { month:'Oct', rate:2.1 }, { month:'Nov', rate:1.8 }, { month:'Dec', rate:3.2 },
  { month:'Jan', rate:1.5 }, { month:'Feb', rate:2.0 }, { month:'Mar', rate:1.2 },
  { month:'Apr', rate:1.8 },
]

const REPORTS = [
  { name:'Headcount Report',     desc:'Current workforce breakdown by department and type', updated:'Today' },
  { name:'Absenteeism Report',   desc:'Rolling 30-day absence and late arrival analysis',   updated:'Today' },
  { name:'Leave Usage Report',   desc:'Leave taken vs. entitlement per employee',            updated:'Yesterday' },
  { name:'Turnover Report',      desc:'Monthly attrition rate with department breakdown',    updated:'This week' },
  { name:'Performance Report',   desc:'Q1 2026 review scores and goal completion rates',     updated:'This week' },
  { name:'Training Compliance',  desc:'Mandatory training completion status across all staff',updated:'Today' },
  { name:'Payroll Summary',      desc:'Monthly salary cost aggregated by department',        updated:'01 Apr 2026' },
  { name:'Audit Trail Report',   desc:'Complete log of all system actions by user',          updated:'Real-time' },
]

export default function Reports() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Reports & Analytics</h2>
          <p className="page-sub">Live data · Export to PDF, Excel, or CSV</p>
        </div>
        <button className="btn-primary text-sm gap-2"><Download size={14}/> Export All</button>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Headcount Trend — 12 months</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={headcountTrend} margin={{ left:-20, bottom:0, top:4, right:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
              <XAxis dataKey="month" tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
              <YAxis domain={[210,255]} tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }} />
              <Line type="monotone" dataKey="count" stroke="#2E86C1" strokeWidth={2} dot={{ r:3, fill:'#2E86C1' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Staff Turnover Rate (%)</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={TURNOVER} barSize={20} margin={{ left:-20, bottom:0, top:4, right:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }} formatter={(v) => [`${v}%`, 'Turnover']} />
              <Bar dataKey="rate" fill="#EF4444" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Weekly Attendance Pattern</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyAttendance} barSize={14} barCategoryGap="30%" margin={{ left:-20, bottom:0, top:4, right:4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize:10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }} />
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize:10 }} />
              <Bar dataKey="present" name="Present" fill="#2E86C1" radius={[3,3,0,0]} />
              <Bar dataKey="absent"  name="Absent"  fill="#EF4444" radius={[3,3,0,0]} />
              <Bar dataKey="late"    name="Late"    fill="#F59E0B" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-secondary mb-4">Department Distribution</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={departmentData} innerRadius={32} outerRadius={52} dataKey="value" paddingAngle={2}>
                  {departmentData.map((d,i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize:11, borderRadius:8, border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {departmentData.map(d => (
                <div key={d.name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-gray-500">{d.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-secondary">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pre-built report list */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-secondary">Pre-Built Reports</p>
        </div>
        <div className="divide-y divide-gray-50">
          {REPORTS.map(r => (
            <div key={r.name} className="px-4 py-3 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  <FileText size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-secondary">{r.name}</p>
                  <p className="text-xs text-gray-400">{r.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-xs text-gray-400 hidden sm:block">Updated: {r.updated}</p>
                <div className="flex gap-1">
                  <button className="btn-outline text-xs px-2 py-1">PDF</button>
                  <button className="btn-outline text-xs px-2 py-1">Excel</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
