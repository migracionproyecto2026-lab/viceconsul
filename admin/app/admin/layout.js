'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV = [
  { href: '/admin',            label: 'Dashboard',    icon: '📊' },
  { href: '/admin/citas',      label: 'Citas',        icon: '📅' },
  { href: '/admin/ciudadanos', label: 'Ciudadanos',   icon: '👥' },
  { href: '/admin/banners',    label: 'Avisos',       icon: '📢' },
  { href: '/admin/kiosco',     label: 'Modo Kiosco',  icon: '🖥' },
]

export default function AdminLayout({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.error) router.push('/login')
      else setUser(d)
    })
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#f3f4f6' }}>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden"
             onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 z-30 flex flex-col
        transform transition-transform duration-200
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ background: '#1a1a2e' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
               style={{ background: '#AA151B' }}>🏛</div>
          <div>
            <div className="text-white text-sm font-bold leading-tight">Viceconsulado</div>
            <div className="text-xs leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>
              España — Nueva Esparta
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => {
            const active = pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                style={active ? { background: '#AA151B' } : {}}>
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User + logout */}
        {user && (
          <div className="px-4 py-4 border-t border-white/10">
            <div className="text-sm font-medium text-white">{user.nombre}</div>
            <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {user.role === 'consul' ? 'Cónsul' : 'Asistente'}
            </div>
            <button onClick={logout}
              className="text-xs px-3 py-2 rounded-lg w-full text-left transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100">
            <div className="space-y-1">
              <span className="block w-5 h-0.5 bg-gray-600"></span>
              <span className="block w-5 h-0.5 bg-gray-600"></span>
              <span className="block w-5 h-0.5 bg-gray-600"></span>
            </div>
          </button>
          <span className="font-semibold text-gray-800">Panel Admin</span>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
