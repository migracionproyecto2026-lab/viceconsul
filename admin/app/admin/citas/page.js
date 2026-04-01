'use client'
import { useEffect, useState } from 'react'

const TRAMITES = [
  'Pasaporte — Primera expedición',
  'Pasaporte — Renovación',
  'Inscripción de nacimiento',
  'Inscripción de matrimonio',
  'Fe de vida',
  'Poderes notariales',
  'Homologaciones',
  'Otro',
]

const ESTADOS = ['pendiente', 'confirmada', 'cancelada', 'completada']
const HORAS = ['08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30']

export default function CitasPage() {
  const today = new Date().toISOString().split('T')[0]
  const [fecha, setFecha] = useState(today)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [citas, setCitas] = useState([])
  const [loading, setLoading] = useState(false)

  // Nueva cita
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ citizenEmail: '', fecha: today, hora: HORAS[0], tramite: TRAMITES[0], notas: '' })
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Editar / reagendar
  const [editCita, setEditCita] = useState(null)
  const [reagendando, setReagendando] = useState(false)
  const [editForm, setEditForm] = useState({ fecha: '', hora: HORAS[0], tramite: '', notas: '', status: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  async function fetchCitas() {
    setLoading(true)
    const params = new URLSearchParams()
    if (fecha) params.set('fecha', fecha)
    if (filtroStatus) params.set('status', filtroStatus)
    const res = await fetch(`/api/admin/citas?${params}`)
    setCitas(await res.json())
    setLoading(false)
  }

  useEffect(() => { fetchCitas() }, [fecha, filtroStatus])

  async function updateStatus(id, status) {
    await fetch(`/api/admin/citas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    fetchCitas()
  }

  function openEdit(cita) {
    const horaCorta = cita.hora?.substring(0, 5) ?? HORAS[0]
    setEditCita(cita)
    setReagendando(false)
    setEditError('')
    setEditForm({
      fecha: cita.fecha,
      hora: HORAS.includes(horaCorta) ? horaCorta : HORAS[0],
      tramite: cita.tramite,
      notas: cita.notas || '',
      status: cita.status,
    })
  }

  function closeEdit() {
    setEditCita(null)
    setReagendando(false)
    setEditError('')
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')

    const body = { status: editForm.status, notas: editForm.notas }
    if (reagendando) {
      body.fecha = editForm.fecha
      body.hora = editForm.hora
      body.tramite = editForm.tramite
    }

    const res = await fetch(`/api/admin/citas/${editCita.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      closeEdit()
      fetchCitas()
    } else {
      const d = await res.json()
      setEditError(d.error || 'Error al guardar')
    }
    setEditSaving(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    const search = await fetch(`/api/admin/ciudadanos?q=${encodeURIComponent(form.citizenEmail)}`)
    const { ciudadanos } = await search.json()
    const citizen = ciudadanos.find(c => c.email === form.citizenEmail)
    if (!citizen) {
      setFormError('No se encontró ciudadano con ese correo')
      setSaving(false)
      return
    }
    const res = await fetch('/api/admin/citas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ citizenId: citizen.id, fecha: form.fecha, hora: form.hora, tramite: form.tramite, notas: form.notas }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ citizenEmail: '', fecha: today, hora: HORAS[0], tramite: TRAMITES[0], notas: '' })
      fetchCitas()
    } else {
      const d = await res.json()
      setFormError(d.error)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Citas</h1>
          <p className="text-gray-500">{citas.length} cita(s) encontradas</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm({ citizenEmail: '', fecha: today, hora: HORAS[0], tramite: TRAMITES[0], notas: '' }); setFormError('') }}
          className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>
          + Nueva cita
        </button>
      </div>

      {/* Filtros */}
      <div className="card mb-4 flex flex-wrap gap-4">
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Fecha</label>
          <input type="date" className="input-field" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div className="flex-1 min-w-40">
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Estado</label>
          <select className="input-field" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={() => { setFecha(''); setFiltroStatus('') }}
          className="self-end btn-secondary text-sm px-4 py-3">Limpiar</button>
      </div>

      {/* Lista de citas */}
      <div className="space-y-3">
        {loading ? (
          <div className="card text-center text-gray-400 py-8">Cargando...</div>
        ) : citas.length === 0 ? (
          <div className="card text-center text-gray-400 py-8">No hay citas para los filtros seleccionados</div>
        ) : citas.map(c => (
          <div key={c.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">
                  {c.citizen.nombre} {c.citizen.apellido}
                </span>
                <span className={`badge badge-${c.status}`}>{c.status}</span>
              </div>
              <div className="text-sm text-gray-600">{c.tramite}</div>
              <div className="text-sm text-gray-400">{c.fecha} a las {c.hora} — {c.citizen.email}</div>
              {c.notas && <div className="text-sm text-gray-500 italic mt-1">"{c.notas}"</div>}
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => openEdit(c)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#f3f4f6', color: '#374151' }}>
                Editar
              </button>
              {c.status === 'pendiente' && (
                <button onClick={() => updateStatus(c.id, 'confirmada')}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: '#dcfce7', color: '#166534' }}>
                  Confirmar
                </button>
              )}
              {(c.status === 'pendiente' || c.status === 'confirmada') && (
                <>
                  <button onClick={() => updateStatus(c.id, 'completada')}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: '#e0e7ff', color: '#3730a3' }}>
                    Completar
                  </button>
                  <button onClick={() => updateStatus(c.id, 'cancelada')}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium"
                    style={{ background: '#fee2e2', color: '#991b1b' }}>
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar cita */}
      {editCita && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Editar cita</h2>
              <button onClick={closeEdit} className="text-gray-400 text-xl">✕</button>
            </div>

            {/* Ciudadano — solo informativo */}
            <div className="mb-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-1">Ciudadano</p>
              <p className="font-semibold text-gray-900">{editCita.citizen.nombre} {editCita.citizen.apellido}</p>
              <p className="text-sm text-gray-500">{editCita.citizen.email}</p>
            </div>

            {editError && (
              <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEdit} className="space-y-4">

              {/* Trámite — bloqueado hasta reagendar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Trámite</label>
                {reagendando ? (
                  <select className="input-field" value={editForm.tramite}
                    onChange={e => setEditForm(f => ({ ...f, tramite: e.target.value }))}>
                    {TRAMITES.map(t => <option key={t}>{t}</option>)}
                  </select>
                ) : (
                  <input
                    className="input-field"
                    value={editForm.tramite}
                    disabled
                    style={{ backgroundColor: '#f9fafb', color: '#6b7280', cursor: 'not-allowed' }}
                  />
                )}
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Estado</label>
                <select className="input-field" value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                  {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
                <textarea className="input-field" rows={2} placeholder="Observaciones..."
                  value={editForm.notas}
                  onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} />
              </div>

              {/* Toggle reagendar */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={reagendando}
                    onChange={e => setReagendando(e.target.checked)}
                    className="w-4 h-4 accent-red-600"
                  />
                  <span className="text-sm font-semibold text-gray-700">Reagendar esta cita</span>
                </label>
              </div>

              {/* Campos de reagendamiento */}
              {reagendando && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nueva fecha *</label>
                    <input className="input-field" type="date" value={editForm.fecha}
                      onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nueva hora *</label>
                    <select className="input-field" value={editForm.hora}
                      onChange={e => setEditForm(f => ({ ...f, hora: e.target.value }))}>
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal nueva cita */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Nueva cita</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            {formError && (
              <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Correo del ciudadano *</label>
                <input className="input-field" type="email" placeholder="correo@ejemplo.com"
                  value={form.citizenEmail}
                  onChange={e => setForm(f => ({ ...f, citizenEmail: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha *</label>
                  <input className="input-field" type="date"
                    value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Hora *</label>
                  <select className="input-field" value={form.hora}
                    onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}>
                    {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Trámite *</label>
                <select className="input-field" value={form.tramite}
                  onChange={e => setForm(f => ({ ...f, tramite: e.target.value }))}>
                  {TRAMITES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notas</label>
                <textarea className="input-field" rows={2} placeholder="Observaciones..."
                  value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Crear cita'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
