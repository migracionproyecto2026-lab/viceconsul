'use client'
import { useEffect, useState, useCallback } from 'react'

const TIPOS_DOC = ['CI Venezuela', 'DNI España', 'NIE', 'NIF', 'Pasaporte', 'CI Colombia', 'Otro']

export default function CiudadanosPage() {
  const [data, setData] = useState({ ciudadanos: [], total: 0, pages: 1 })
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)

  // Estado del modal
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const q = search ? `&q=${encodeURIComponent(search)}` : ''
    const res = await fetch(`/api/admin/ciudadanos?page=${page}${q}`)
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { setPage(1) }, [search])

  async function openDetail(id) {
    const res = await fetch(`/api/admin/ciudadanos/${id}`)
    const json = await res.json()
    setSelected(json)
    setEditMode(false)
    setEditError('')
  }

  function closeModal() {
    setSelected(null)
    setEditMode(false)
    setEditError('')
  }

  function startEdit() {
    setEditForm({
      nombre: selected.nombre,
      apellido: selected.apellido,
      email: selected.email,
      telefono: selected.telefono || '',
      cedula: selected.cedula || '',
      tipoDocumento: selected.tipoDocumento || '',
    })
    setEditError('')
    setEditMode(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setEditError('')
    const res = await fetch(`/api/admin/ciudadanos/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    if (res.ok) {
      await openDetail(selected.id)
      setEditMode(false)
      fetchData()
    } else {
      const d = await res.json()
      setEditError(d.error || 'Error al guardar')
    }
    setSaving(false)
  }

  async function handleVerificar() {
    setSaving(true)
    await fetch(`/api/admin/ciudadanos/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verificar: true }),
    })
    await openDetail(selected.id)
    fetchData()
    setSaving(false)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ciudadanos</h1>
        <p className="text-gray-500">{data.total} registrados en total</p>
      </div>

      <div className="card mb-4">
        <input
          className="input-field"
          type="text"
          placeholder="Buscar por nombre, apellido, correo o cédula..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nombre', 'Correo', 'Documento', 'Teléfono', 'Estado', 'Citas', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : data.ciudadanos.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No se encontraron ciudadanos</td></tr>
            ) : data.ciudadanos.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{c.nombre} {c.apellido}</td>
                <td className="px-4 py-3 text-gray-600">{c.email}</td>
                <td className="px-4 py-3 text-gray-600">
                  {c.tipoDocumento && <span className="text-xs text-gray-400 mr-1">{c.tipoDocumento}</span>}
                  {c.cedula || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{c.telefono || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${c.verified ? 'badge-confirmada' : 'badge-pendiente'}`}>
                    {c.verified ? 'Verificado' : 'Sin verificar'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{c._count.citas}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => openDetail(c.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{ background: '#fff0f0', color: '#AA151B' }}>
                    Ver ficha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">← Anterior</button>
          <span className="px-4 py-2 text-sm text-gray-600">Pág. {page} de {data.pages}</span>
          <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
            className="btn-secondary px-4 py-2 text-sm disabled:opacity-40">Siguiente →</button>
        </div>
      )}

      {/* Modal ficha ciudadano */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">

            {/* Cabecera */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selected.nombre} {selected.apellido}
                </h2>
                <p className="text-sm text-gray-500">{selected.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${selected.verified ? 'badge-confirmada' : 'badge-pendiente'}`}>
                  {selected.verified ? 'Verificado' : 'Sin verificar'}
                </span>
                <button onClick={closeModal} className="text-gray-400 text-xl font-bold ml-2">✕</button>
              </div>
            </div>

            {editError && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
                {editError}
              </div>
            )}

            {/* ── MODO LECTURA ── */}
            {!editMode && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                  {[
                    ['Tipo documento', selected.tipoDocumento || '—'],
                    ['Nro. documento', selected.cedula || '—'],
                    ['Teléfono', selected.telefono || '—'],
                    ['Registrado', new Date(selected.createdAt).toLocaleDateString('es-VE')],
                    ['Origen', selected.esInvitado ? 'Web (invitado)' : 'Cuenta propia'],
                  ].map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 font-semibold uppercase mb-1">{k}</div>
                      <div className="font-medium text-gray-800">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Posibles duplicados */}
                {selected.duplicados?.length > 0 && (
                  <div className="mb-5 p-3 rounded-xl border" style={{ borderColor: '#fbbf24', background: '#fffbeb' }}>
                    <p className="text-xs font-bold uppercase mb-2" style={{ color: '#92400e' }}>
                      Posible duplicado — mismo nombre completo
                    </p>
                    <div className="space-y-2">
                      {selected.duplicados.map(d => (
                        <div key={d.id} className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium text-gray-800">{d.tipoDocumento || '—'}</span>
                            <span className="text-gray-500 ml-2">{d.cedula || 'sin doc.'}</span>
                            <span className="text-gray-400 ml-2">· {d.email}</span>
                          </div>
                          <button
                            onClick={() => openDetail(d.id)}
                            className="text-xs px-2 py-1 rounded font-medium"
                            style={{ background: '#fff', color: '#AA151B', border: '1px solid #fca5a5' }}>
                            Ver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historial citas */}
                {selected.citas?.length > 0 && (
                  <div className="mb-5">
                    <h3 className="font-semibold text-gray-700 mb-2 text-sm">Historial de citas</h3>
                    <div className="space-y-2">
                      {selected.citas.map(cita => (
                        <div key={cita.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 text-sm">
                          <div>
                            <div className="font-medium">{cita.tramite}</div>
                            <div className="text-gray-500">{cita.fecha} — {cita.hora}</div>
                          </div>
                          <span className={`badge badge-${cita.status}`}>{cita.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div className="flex gap-2 mt-4">
                  <button onClick={startEdit}
                    className="btn-secondary text-sm px-4 py-2" style={{ flex: 1 }}>
                    Editar datos
                  </button>
                  {!selected.verified && (
                    <button onClick={handleVerificar} disabled={saving}
                      className="btn-primary text-sm px-4 py-2" style={{ flex: 1 }}>
                      {saving ? 'Guardando...' : 'Verificar ciudadano'}
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── MODO EDICIÓN ── */}
            {editMode && (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nombres *</label>
                    <input className="input-field" value={editForm.nombre}
                      onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Apellidos *</label>
                    <input className="input-field" value={editForm.apellido}
                      onChange={e => setEditForm(f => ({ ...f, apellido: e.target.value }))} required />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Correo *</label>
                  <input className="input-field" type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo documento</label>
                    <select className="input-field" value={editForm.tipoDocumento}
                      onChange={e => setEditForm(f => ({ ...f, tipoDocumento: e.target.value }))}>
                      <option value="">— Sin especificar —</option>
                      {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Nro. documento</label>
                    <input className="input-field" value={editForm.cedula}
                      onChange={e => setEditForm(f => ({ ...f, cedula: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
                  <input className="input-field" value={editForm.telefono}
                    onChange={e => setEditForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setEditMode(false); setEditError('') }}
                    className="btn-secondary text-sm px-4 py-2" style={{ flex: 1 }}>
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="btn-primary text-sm px-4 py-2" style={{ flex: 1 }}>
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
