'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.needsVerify) {
          router.push(`/verify?email=${encodeURIComponent(data.email)}`)
          return
        }
        setError(data.error)
        return
      }
      router.push(data.redirect || '/')
      router.refresh()
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#f3f4f6' }}>
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
               style={{ background: '#AA151B' }}>
            <span className="text-white text-2xl">🏛</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Viceconsulado de España</h1>
          <p className="text-gray-500 mt-1">Nueva Esparta, Venezuela</p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-6 text-gray-800">Iniciar sesión</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium"
                 style={{ background: '#fee2e2', color: '#991b1b' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="tu@correo.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn-primary mt-2"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="font-semibold"
                  style={{ color: '#AA151B' }}>
              Regístrate aquí
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Sistema de gestión consular — uso exclusivo autorizado
        </p>
      </div>
    </div>
  )
}
