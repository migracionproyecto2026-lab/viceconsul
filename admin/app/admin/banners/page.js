'use client'
import { useEffect, useState } from 'react'

export default function BannersPage() {
  const [banners, setBanners] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ titulo: '', cuerpo: '', activo: true, orden: 0 })
  const [saving, setSaving] = useState(false)

  async function fetchBanners() {
    const res = await fetch('/api/admin/banners')
    setBanners(await res.json())
  }

  useEffect(() => { fetchBanners() }, [])

  function openNew() {
    setEditing(null)
    setForm({ titulo: '', cuerpo: '', activo: true, orden: banners.length })
    setShowForm(true)
  }

  function openEdit(b) {
    setEditing(b)
    setForm({ titulo: b.titulo, cuerpo: b.cuerpo, activo: b.activo, orden: b.orden })
    setShowForm(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      await fetch(`/api/admin/banners/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/admin/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
    }
    setSaving(false)
    setShowForm(false)
    fetchBanners()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este aviso?')) return
    await fetch(`/api/admin/banners/${id}`, { method: 'DELETE' })
    fetchBanners()
  }

  async function toggleActive(b) {
    await fetch(`/api/admin/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !b.activo }),
    })
    fetchBanners()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avisos y Comunicados</h1>
          <p className="text-gray-500">Gestiona el carrusel de noticias de la web pública</p>
        </div>
        <button onClick={openNew} className="btn-primary"
          style={{ width: 'auto', padding: '10px 20px' }}>
          + Nuevo aviso
        </button>
      </div>

      <div className="space-y-3">
        {banners.length === 0 ? (
          <div className="card text-center text-gray-400 py-8">No hay avisos creados</div>
        ) : banners.map(b => (
          <div key={b.id} className="card flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">{b.titulo}</span>
                <span className={`badge ${b.activo ? 'badge-confirmada' : 'badge-cancelada'}`}>
                  {b.activo ? 'Activo' : 'Inactivo'}
                </span>
                <span className="text-xs text-gray-400">Orden: {b.orden}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{b.cuerpo}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => toggleActive(b)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#f3f4f6', color: '#374151' }}>
                {b.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => openEdit(b)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#dbeafe', color: '#1e40af' }}>
                Editar
              </button>
              <button onClick={() => handleDelete(b.id)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#fee2e2', color: '#991b1b' }}>
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">{editing ? 'Editar aviso' : 'Nuevo aviso'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Título *</label>
                <input className="input-field" type="text" placeholder="Título del aviso"
                  value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cuerpo *</label>
                <textarea className="input-field" rows={4} placeholder="Contenido del aviso..."
                  value={form.cuerpo} onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Orden</label>
                  <input className="input-field" type="number" min={0}
                    value={form.orden} onChange={e => setForm(f => ({ ...f, orden: parseInt(e.target.value) }))} />
                </div>
                <div className="flex items-center gap-2 mt-6">
                  <input type="checkbox" id="activo" checked={form.activo}
                    onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4" />
                  <label htmlFor="activo" className="text-sm font-medium text-gray-700">Publicado</label>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : (editing ? 'Guardar cambios' : 'Crear aviso')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
