'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function VerifyPage() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get('email') || ''
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const inputs = useRef([])

  const code = digits.join('')

  function handleDigit(i, val) {
    if (!/^\d?$/.test(val)) return
    const next = [...digits]
    next[i] = val
    setDigits(next)
    if (val && i < 5) inputs.current[i + 1]?.focus()
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus()
    }
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      inputs.current[5]?.focus()
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (code.length !== 6) { setError('Ingresa los 6 dígitos'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setSuccess('¡Cuenta verificada! Redirigiendo...')
      setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1500)
    } catch {
      setError('Error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResent(false)
    setError('')
    const res = await fetch('/api/auth/verify', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (res.ok) setResent(true)
    else setError('No se pudo reenviar. Intenta más tarde.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f3f4f6' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
               style={{ background: '#AA151B' }}>
            <span className="text-white text-2xl">✉️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Verifica tu correo</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Enviamos un código de 6 dígitos a<br />
            <strong className="text-gray-700">{email}</strong>
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium"
                 style={{ background: '#fee2e2', color: '#991b1b' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium"
                 style={{ background: '#dcfce7', color: '#166534' }}>
              {success}
            </div>
          )}
          {resent && (
            <div className="mb-4 p-3 rounded-lg text-sm font-medium"
                 style={{ background: '#dbeafe', color: '#1e40af' }}>
              Código reenviado. Revisa tu correo.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-gray-700 mb-3 text-center">
              Código de verificación
            </label>
            <div className="flex gap-3 justify-center mb-6" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => inputs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigit(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  style={{
                    width: 52, height: 64, textAlign: 'center',
                    fontSize: 28, fontWeight: 700,
                    border: '2px solid #d1d5db', borderRadius: 10,
                    background: d ? '#fff0f0' : 'white',
                    borderColor: d ? '#AA151B' : '#d1d5db',
                  }}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button type="submit" className="btn-primary" disabled={loading || code.length !== 6}>
              {loading ? 'Verificando...' : 'Verificar cuenta'}
            </button>
          </form>

          <div className="text-center mt-5">
            <p className="text-sm text-gray-500">¿No recibiste el código?</p>
            <button
              onClick={handleResend}
              className="text-sm font-semibold mt-1"
              style={{ color: '#AA151B', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Reenviar código
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
