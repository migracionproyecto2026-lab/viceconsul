import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-secret-change-in-production'
)

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('auth_token')?.value

  // Rutas del admin — solo asistente o consul
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login?from=admin', request.url))
    }
    try {
      const { payload } = await jwtVerify(token, SECRET)
      if (payload.role !== 'asistente' && payload.role !== 'consul') {
        return NextResponse.redirect(new URL('/login?from=admin', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login?from=admin', request.url))
    }
  }

  // Dashboard ciudadano — solo citizens
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    try {
      const { payload } = await jwtVerify(token, SECRET)
      if (payload.role !== 'citizen') {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Si ya está logueado y va a /login o /register, redirigir
  if ((pathname === '/login' || pathname === '/register') && token) {
    try {
      const { payload } = await jwtVerify(token, SECRET)
      if (payload.role === 'citizen') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      if (payload.role === 'asistente' || payload.role === 'consul') {
        return NextResponse.redirect(new URL('/admin', request.url))
      }
    } catch {
      // token inválido, dejar pasar
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/login', '/register'],
}
