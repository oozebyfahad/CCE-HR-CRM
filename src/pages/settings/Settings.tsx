import { useState } from 'react'
import { Save, Shield, Bell, Palette, Globe, Database, Users } from 'lucide-react'

const TABS = [
  { key:'general',       label:'General',       Icon: Globe     },
  { key:'security',      label:'Security',      Icon: Shield    },
  { key:'notifications', label:'Notifications', Icon: Bell      },
  { key:'appearance',    label:'Appearance',    Icon: Palette   },
  { key:'data',          label:'Data & GDPR',   Icon: Database  },
  { key:'roles',         label:'Roles & Access',Icon: Users     },
]

export default function Settings() {
  const [tab, setTab] = useState('general')

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="page-header">Settings</h2>
        <p className="page-sub">System configuration and administration</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        {/* Sidebar */}
        <div className="card p-2 sm:w-48 shrink-0 h-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                tab === t.key ? 'bg-primary text-white font-medium' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <t.Icon size={15} className="shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 card p-6 space-y-6">
          {tab === 'general' && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-secondary mb-4">Organisation Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['Company Name',    'CabCallExperts'],
                    ['Legal Name',      'CabCallExperts Ltd'],
                    ['Company Website', 'www.cabcallexperts.com'],
                    ['HR Email',        'hr@cabcallexperts.com'],
                    ['Financial Year',  'April – March'],
                    ['Working Hours',   '37.5 hrs/week'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <label className="label">{label}</label>
                      <input className="input text-sm" defaultValue={value} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-secondary mb-4">Leave Settings</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    ['Annual Leave Entitlement', '28 days'],
                    ['Carry-over Limit',         '5 days'],
                    ['Sick Leave (paid)',         '10 days/year'],
                    ['Notice Period',            '4 weeks'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <label className="label">{label}</label>
                      <input className="input text-sm" defaultValue={value} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'security' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-secondary">Security & Authentication</h3>
              {[
                { label:'Require 2FA for HR Admins', desc:'Senior HR roles must use two-factor authentication', checked:true },
                { label:'Session Timeout (30 mins)', desc:'Auto-logout after 30 minutes of inactivity',         checked:true },
                { label:'Password Complexity',       desc:'Require min 8 chars, upper, lower, number',          checked:true },
                { label:'Login Attempt Limit',       desc:'Lock account after 5 failed attempts',               checked:false },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-secondary">{s.label}</p>
                    <p className="text-xs text-gray-400">{s.desc}</p>
                  </div>
                  <div className={`w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${s.checked ? 'bg-primary justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-4 h-4 rounded-full bg-white shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-secondary">Notification Preferences</h3>
              {[
                { label:'Leave request submitted',      checked:true  },
                { label:'Leave approved / declined',    checked:true  },
                { label:'Performance review due',       checked:true  },
                { label:'Contract expiry (30 days)',    checked:true  },
                { label:'Right-to-work expiry (14 days)',checked:true },
                { label:'Probation review due',         checked:true  },
                { label:'New employee added',           checked:false },
                { label:'Disciplinary case opened',     checked:true  },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-secondary">{n.label}</p>
                  <div className={`w-10 h-5 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${n.checked ? 'bg-primary justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-4 h-4 rounded-full bg-white shadow" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'data' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-secondary">Data & GDPR Compliance</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs text-blue-800 font-medium mb-1">UK GDPR Compliance Active</p>
                <p className="text-xs text-blue-700">This system is built with GDPR compliance by design. All employee data is encrypted at rest (AES-256) and in transit (TLS 1.3). Audit logs are retained for 7 years per UK employment law.</p>
              </div>
              {[
                { label:'Data Retention Policy',  value:'7 years (UK employment law)' },
                { label:'Backup Frequency',       value:'Daily, 30-day retention' },
                { label:'Document Storage',       value:'AWS S3 (encrypted)' },
                { label:'Encryption Standard',    value:'AES-256 at rest · TLS 1.3 in transit' },
                { label:'Last Backup',            value:'Today 02:00 AM' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-sm font-medium text-secondary">{value}</p>
                </div>
              ))}
            </div>
          )}

          {(tab === 'appearance' || tab === 'roles') && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
                <Save size={20} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-secondary">Coming Soon</p>
              <p className="text-xs text-gray-400">This settings section is in development.</p>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button className="btn-primary text-sm gap-2"><Save size={14}/> Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  )
}
