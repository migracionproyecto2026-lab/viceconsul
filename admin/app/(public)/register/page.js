'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', password: '', confirmar: '',
    telefono: '', cedula: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
          password: form.password,
          telefono: form.telefono || undefined,
          cedula: form.cedula || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push(`/verify?email=${encodeURIComponent(form.email)}`)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#f3f4f6' }}>
      <div className="w-full max-w-lg">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
               style={{ background: '#AA151B' }}>
            <span className="text-white text-2xl">🏛</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-gray-500 mt-1">Viceconsulado de España — Nueva Esparta</p>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Datos personales</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium"
                 style={{ background: '#fee2e2', color: '#991b1b' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nombre *</label>
                <input className="input-field" type="text" placeholder="Juan"
                  value={form.nombre} onChange={set('nombre')} required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Apellido *</label>
                <input className="input-field" type="text" placeholder="García"
                  value={form.apellido} onChange={set('apellido')} required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Correo electrónico *</label>
              <input className="input-field" type="email" placeholder="tu@correo.com"
                value={form.email} onChange={set('email')} required autoComplete="email" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Teléfono</label>
                <input className="input-field" type="tel" placeholder="+58 414..."
                  value={form.telefono} onChange={set('telefono')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Cédula / NIE</label>
                <input className="input-field" type="text" placeholder="V-12345678"
                  value={form.cedula} onChange={set('cedula')} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Contraseña *</label>
              <input className="input-field" type="password" placeholder="Mínimo 8 caracteres"
                value={form.password} onChange={set('password')} required autoComplete="new-password" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Confirmar contraseña *</label>
              <input className="input-field" type="password" placeholder="Repite tu contraseña"
                value={form.confirmar} onChange={set('confirmar')} required autoComplete="new-password" />
            </div>

            <button type="submit" className="btn-primary mt-2" disabled={loading}>
              {loading ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#AA151B' }}>
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
