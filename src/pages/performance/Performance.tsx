import { useState } from 'react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Badge, statusVariant } from '../../components/common/Badge'
import { Avatar } from '../../components/common/Avatar'
import { mockReviews } from '../../utils/mockData'
import { useAppSelector } from '../../store'

const radarData = [
  { skill: 'Communication', score: 8 },
  { skill: 'Teamwork',      score: 7 },
  { skill: 'Productivity',  score: 9 },
  { skill: 'Punctuality',   score: 6 },
  { skill: 'Initiative',    score: 8 },
  { skill: 'Knowledge',     score: 9 },
]

export default function Performance() {
  const currentUser = useAppSelector(s => s.auth.user)
  const isEmployee  = currentUser?.role === 'employee'

  const visibleReviews = isEmployee
    ? mockReviews.filter(r => r.employeeName === currentUser?.name)
    : mockReviews

  const [selected, setSelected] = useState(visibleReviews[0] ?? null)

  // Employee with no review yet
  if (isEmployee && visibleReviews.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="page-header">My Performance</h2>
          <p className="page-sub">Your performance review</p>
        </div>
        <div className="card p-12 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp size={24} className="text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-secondary">No Performance Review Yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Your manager hasn't submitted a review for you yet. Contact HR or your manager.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">{isEmployee ? 'My Performance' : 'Performance Management'}</h2>
          <p className="page-sub">{isEmployee ? 'Your performance review' : 'Q1 2026 review cycle'}</p>
        </div>
        {!isEmployee && <button className="btn-primary text-sm">+ New Review</button>}
      </div>

      {/* Summary cards — HR/admin only */}
      {!isEmployee && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Avg Score',       value: '7.8/10', color: '#2E86C1' },
            { label: 'Reviews Done',    value: '87%',    color: '#10B981' },
            { label: 'Goals Completed', value: '72%',    color: '#F59E0B' },
            { label: 'On PIPs',         value: '4',      color: '#EF4444' },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 ${!isEmployee ? 'lg:grid-cols-3' : ''} gap-4`}>

        {/* Review queue — HR/admin only */}
        {!isEmployee && (
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-secondary">Review Queue</p>
            </div>
            <div className="divide-y divide-gray-50">
              {visibleReviews.map(r => (
                <div key={r.id} onClick={() => setSelected(r)}
                  className={`p-4 cursor-pointer hover:bg-primary-50/30 transition-colors ${selected?.id === r.id ? 'bg-primary-50/50' : ''}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar name={r.employeeName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-secondary">{r.employeeName}</p>
                      <p className="text-xs text-gray-400">{r.reviewPeriod} · by {r.reviewerName}</p>
                    </div>
                    <Badge variant={statusVariant(r.status)} size="xs">{r.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(r.score / 10) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-secondary">{r.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review detail */}
        <div className={`${!isEmployee ? 'lg:col-span-2' : ''} space-y-4`}>
          {selected && (
            <>
              <div className="card p-5">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar name={selected.employeeName} size="md" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-secondary">{selected.employeeName}</h3>
                    <p className="text-xs text-gray-400">
                      {selected.reviewPeriod} · Due: {new Date(selected.reviewDate).toLocaleDateString('en-GB')}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Reviewed by {selected.reviewerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{selected.score}</p>
                    <p className="text-xs text-gray-400">/10</p>
                  </div>
                </div>

                <p className="section-title">Goals</p>
                <div className="space-y-3">
                  {selected.goals.map(g => (
                    <div key={g.id} className="border border-gray-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-secondary">{g.title}</p>
                        <Badge variant={statusVariant(g.status)} size="xs">{g.status.replace('_', ' ')}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${g.progress}%` }} />
                        </div>
                        <span className="text-xs font-medium text-secondary w-8 text-right">{g.progress}%</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Due: {new Date(g.dueDate).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <p className="section-title">Competency Scores</p>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#E2E8F0" />
                    <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                    <Radar dataKey="score" stroke="#2E86C1" fill="#2E86C1" fillOpacity={0.15} strokeWidth={2} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
