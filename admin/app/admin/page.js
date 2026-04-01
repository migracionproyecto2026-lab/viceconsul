'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

function StatCard({ label, value, icon, color, href }) {
  const content = (
    <div className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
           style={{ background: color + '20' }}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value ?? '—'}</div>
        <div className="text-sm text-gray-500 font-medium">{label}</div>
      </div>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [citas, setCitas] = useState([])

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats)
    const hoy = new Date().toISOString().split('T')[0]
    fetch(`/api/admin/citas?fecha=${hoy}`).then(r => r.json()).then(setCitas)
  }, [])

  const today = new Date().toLocaleDateString('es-VE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 capitalize">{today}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard label="Ciudadanos registrados" value={stats?.totalCiudadanos}
          icon="👥" color="#AA151B" href="/admin/ciudadanos" />
        <StatCard label="Citas pendientes" value={stats?.citasPendientes}
          icon="⏳" color="#F59E0B" href="/admin/citas" />
        <StatCard label="Citas hoy" value={stats?.citasHoy}
          icon="📅" color="#10B981" href="/admin/citas" />
        <StatCard label="Citas esta semana" value={stats?.citasSemana}
          icon="📆" color="#6366F1" href="/admin/citas" />
        <StatCard label="Formularios pendientes" value={stats?.formulariosPendientes}
          icon="📋" color="#EC4899" />
        <StatCard label="Cuentas verificadas" value={stats?.ciudadanosVerificados}
          icon="✅" color="#10B981" href="/admin/ciudadanos" />
      </div>

      {/* Citas de hoy */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Citas de hoy</h2>
          <Link href="/admin/citas" className="text-sm font-medium" style={{ color: '#AA151B' }}>
            Ver todas →
          </Link>
        </div>

        {citas.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No hay citas programadas para hoy</p>
        ) : (
          <div className="space-y-3">
            {citas.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <div className="font-medium text-gray-900">
                    {c.citizen.nombre} {c.citizen.apellido}
                  </div>
                  <div className="text-sm text-gray-500">{c.tramite} — {c.hora}</div>
                </div>
                <span className={`badge badge-${c.status}`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
