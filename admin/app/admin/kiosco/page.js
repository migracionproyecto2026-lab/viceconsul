'use client'
import { useState } from 'react'

const TRAMITES = [
  { id: 'pasaporte-nuevo', label: 'Pasaporte — Primera expedición', icon: '🛂' },
  { id: 'pasaporte-reno', label: 'Pasaporte — Renovación', icon: '🔄' },
  { id: 'nacimiento', label: 'Inscripción de nacimiento', icon: '👶' },
  { id: 'matrimonio', label: 'Inscripción de matrimonio', icon: '💍' },
  { id: 'fe-vida', label: 'Fe de vida', icon: '✅' },
  { id: 'poder', label: 'Poder notarial', icon: '📜' },
  { id: 'homologacion', label: 'Homologación', icon: '🎓' },
  { id: 'otro', label: 'Otro trámite', icon: '📋' },
]

export default function KioscoPage() {
  const [step, setStep] = useState('tramite') // tramite | datos | confirmado
  const [tramite, setTramite] = useState(null)
  const [form, setForm] = useState({ nombre: '', apellido: '', cedula: '', telefono: '', email: '', nota: '' })
  const [loading, setLoading] = useState(false)
  const [ticket, setTicket] = useState(null)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const datos = JSON.stringify(form)
    const res = await fetch('/api/admin/formularios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tramite: tramite.label, datos }),
    })
    const data = await res.json()
    setTicket(data.id || 'N/A')
    setStep('confirmado')
    setLoading(false)
  }

  function reset() {
    setStep('tramite')
    setTramite(null)
    setForm({ nombre: '', apellido: '', cedula: '', telefono: '', email: '', nota: '' })
    setTicket(null)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#1a1a2e' }}>
      {/* Header kiosco */}
      <div className="py-6 px-8 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
             style={{ background: '#AA151B' }}>🏛</div>
        <div>
          <div className="text-white text-xl font-bold">Viceconsulado Honorario de España</div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Nueva Esparta, Venezuela — Modo Atención Presencial
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-8 pb-8">
        <div className="w-full max-w-2xl">

          {/* PASO 1 — Seleccionar trámite */}
          {step === 'tramite' && (
            <div>
              <h2 className="text-white text-2xl font-bold mb-2">¿Qué trámite desea realizar?</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)' }} className="mb-6">
                Seleccione una opción para continuar
              </p>
              <div className="grid grid-cols-2 gap-4">
                {TRAMITES.map(t => (
                  <button key={t.id}
                    onClick={() => { setTramite(t); setStep('datos') }}
                    className="flex items-center gap-4 p-5 rounded-xl text-left transition-all hover:scale-105"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span className="text-3xl">{t.icon}</span>
                    <span className="text-white font-medium text-sm leading-snug">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2 — Datos personales */}
          {step === 'datos' && (
            <div>
              <button onClick={() => setStep('tramite')}
                className="text-sm mb-4 flex items-center gap-1"
                style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}>
                ← Volver
              </button>
              <div className="rounded-xl p-4 mb-6 flex items-center gap-3"
                   style={{ background: 'rgba(170,21,27,0.3)', border: '1px solid rgba(170,21,27,0.5)' }}>
                <span className="text-2xl">{tramite.icon}</span>
                <div>
                  <div className="text-white font-semibold">{tramite.label}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Trámite seleccionado</div>
                </div>
              </div>

              <h2 className="text-white text-xl font-bold mb-4">Sus datos personales</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'rgba(255,255,255,0.7)' }}>Nombre *</label>
                    <input className="input-field" style={{ fontSize: 18 }}
                      value={form.nombre} onChange={set('nombre')} required placeholder="Juan" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'rgba(255,255,255,0.7)' }}>Apellido *</label>
                    <input className="input-field" style={{ fontSize: 18 }}
                      value={form.apellido} onChange={set('apellido')} required placeholder="García" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'rgba(255,255,255,0.7)' }}>Cédula / DNI *</label>
                    <input className="input-field" style={{ fontSize: 18 }}
                      value={form.cedula} onChange={set('cedula')} required placeholder="V-12345678" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1"
                           style={{ color: 'rgba(255,255,255,0.7)' }}>Teléfono *</label>
                    <input className="input-field" style={{ fontSize: 18 }} type="tel"
                      value={form.telefono} onChange={set('telefono')} required placeholder="+58 414..." />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1"
                         style={{ color: 'rgba(255,255,255,0.7)' }}>Correo electrónico</label>
                  <input className="input-field" style={{ fontSize: 18 }} type="email"
                    value={form.email} onChange={set('email')} placeholder="opcional" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1"
                         style={{ color: 'rgba(255,255,255,0.7)' }}>Observaciones</label>
                  <textarea className="input-field" rows={2}
                    value={form.nota} onChange={set('nota')} placeholder="Información adicional..." />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}
                  style={{ fontSize: 18, padding: '16px 24px' }}>
                  {loading ? 'Registrando...' : 'Confirmar y registrar'}
                </button>
              </form>
            </div>
          )}

          {/* PASO 3 — Confirmado */}
          {step === 'confirmado' && (
            <div className="text-center py-12">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto mb-6"
                   style={{ background: 'rgba(16,185,129,0.2)' }}>
                ✅
              </div>
              <h2 className="text-white text-3xl font-bold mb-3">¡Registro completado!</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)' }} className="text-lg mb-2">
                Su solicitud ha sido recibida
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)' }} className="text-sm mb-8">
                Un funcionario lo atenderá en breve
              </p>
              <button onClick={reset} className="btn-primary"
                style={{ width: 'auto', padding: '14px 40px', fontSize: 17 }}>
                Nueva solicitud
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
