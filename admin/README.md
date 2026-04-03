# Viceconsulado Admin — Panel de Gestión

Servidor Express que expone la API REST del Viceconsulado y sirve el panel de administración como HTML estático. Usa Prisma con MongoDB Atlas como base de datos.

---

## Stack

- **Runtime:** Node.js + Express
- **Base de datos:** MongoDB Atlas vía Prisma ORM
- **Autenticación:** JWT en cookie HttpOnly
- **Correo:** Nodemailer + Gmail
- **Deploy:** Railway (`start.sh` → `prisma db push` → `node server.js`)

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | `mongodb+srv://usuario:pass@cluster.mongodb.net/viceconsul` |
| `JWT_SECRET` | Sí | Clave para firmar tokens de sesión |
| `PORT` | No | Puerto (Railway lo asigna; local usa 3000) |
| `GMAIL_USER` | No | Correo remitente de notificaciones |
| `GMAIL_PASS` | No | Contraseña de aplicación de Gmail |

---

## Quick-start local

```bash
npm install
cp .env.example .env   # completar DATABASE_URL y JWT_SECRET
npx prisma db push
npm run dev            # → http://localhost:3000
```

---

## Primer uso: crear superadmin

El endpoint `/api/setup` solo funciona si no existe ningún admin en la base de datos:

```bash
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Admin","email":"admin@consulado.com","password":"clave1234"}'
```

Una vez creado el primer admin, el endpoint queda bloqueado automáticamente.

---

## Rutas de la API

### Públicas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/config` | Configuración pública del consulado (desde BD) |
| `GET` | `/api/banners` | Banners activos para la web pública |
| `GET` | `/api/fechas-bloqueadas` | Fechas sin disponibilidad |
| `GET` | `/api/public/verificar` | Verificar si existe un ciudadano por cédula o email |
| `POST` | `/api/public/cita` | Solicitar cita desde la web pública |
| `POST` | `/api/setup` | Crear primer superadmin (solo si no hay ninguno) |

### Autenticación (`/api/auth`)

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/register` | Registro de ciudadano |
| `POST` | `/api/auth/login` | Login (admin o ciudadano) |
| `POST` | `/api/auth/verify` | Verificar cuenta con código de email |
| `POST` | `/api/auth/logout` | Cerrar sesión |
| `GET` | `/api/auth/me` | Obtener sesión activa |

### Admin (requiere sesión de admin) (`/api/admin`)

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/stats` | Estadísticas del dashboard |
| `GET` | `/api/admin/citas` | Listar citas (filtros: fecha, status, mes, rango) |
| `POST` | `/api/admin/citas` | Crear cita desde el panel |
| `PATCH` | `/api/admin/citas/:id` | Actualizar estado, notas, documentos pendientes |
| `DELETE` | `/api/admin/citas/:id` | Eliminar cita |
| `GET` | `/api/admin/ciudadanos` | Listar ciudadanos registrados |
| `GET` | `/api/admin/buzon` | Buzón de actividad reciente |
| `GET` | `/api/admin/banners` | Listar banners |
| `POST` | `/api/admin/banners` | Crear banner |
| `PATCH` | `/api/admin/banners/:id` | Editar banner |
| `DELETE` | `/api/admin/banners/:id` | Eliminar banner |
| `GET` | `/api/admin/fechas-bloqueadas` | Listar fechas bloqueadas |
| `POST` | `/api/admin/fechas-bloqueadas` | Bloquear fecha |
| `DELETE` | `/api/admin/fechas-bloqueadas/:id` | Desbloquear fecha |

---

## Modelos de base de datos

| Modelo | Descripción |
|---|---|
| `Citizen` | Ciudadanos registrados (con o sin cuenta) |
| `AdminUser` | Usuarios del panel (roles: `superadmin`, `asistente`) |
| `Appointment` | Citas consulares |
| `ActivityLog` | Buzón de actividad y auditoría |
| `Banner` | Avisos de la web pública |
| `BlockedDate` | Fechas sin disponibilidad |
| `Setting` | Configuración general del consulado |
