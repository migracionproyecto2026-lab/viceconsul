# DESARROLLO — Viceconsulado Honorario de España en Nueva Esparta

**Documento técnico interno. No público.**
Última actualización: 2026-05-28

---

## 1. Visión general

Portal del Viceconsulado Honorario de España en Nueva Esparta, Venezuela. Dos componentes:

| Componente | Tecnología | Despliegue | Estado |
|------------|-----------|-----------|--------|
| `web/` — sitio público | HTML/CSS/JS estático | GitHub Pages | ✅ producción |
| `admin/` — panel de gestión | Node.js + Express + Prisma + MongoDB | (antes Railway, ahora servidor dedicado pendiente) | ⚠️ caído por cuota Railway |

Una vez probado en Nueva Esparta, será replicable a otros viceconsulados honorarios.

---

## 2. Stack y dependencias

### Web pública
- HTML estático puro, sin build, sin framework.
- Servido desde GitHub Pages con dominio personalizado (`web/CNAME`).
- Llama al admin para datos dinámicos (banners, fechas bloqueadas, formulario de cita).

### Admin
- **Runtime:** Node.js (LTS).
- **Framework:** Express 4.21.
- **ORM:** Prisma 5.22 contra MongoDB.
- **Auth:** JWT (`jsonwebtoken`) en cookie httpOnly + bcrypt (cost 12).
- **Email:** nodemailer (SMTP Office365 hoy; migrando a Gmail con App Password).
- **Rate limit:** `express-rate-limit`.
- **Scheduler:** `setInterval` 60s (`lib/scheduler.js`).

`admin/package.json` para versiones exactas.

---

## 3. Estructura de carpetas

```
viceconsul/
├─ web/                     ← sitio público (intocable sin aprobación)
│  ├─ index.html
│  ├─ aviso-legal.html
│  ├─ politica-privacidad.html
│  ├─ CNAME
│  ├─ images/
│  ├─ documentos/
│  └─ scripts/
├─ admin/                   ← panel admin (Node)
│  ├─ server.js             ← entry point, rutas públicas, middleware global
│  ├─ start.sh              ← arranque para Railway/servidor (prisma push + node)
│  ├─ nixpacks.toml         ← config build Railway
│  ├─ package.json
│  ├─ .env                  ← gitignored, variables locales
│  ├─ .env.example          ← plantilla
│  ├─ prisma/
│  │  ├─ schema.prisma      ← modelos MongoDB
│  │  └─ migrations/
│  ├─ lib/
│  │  ├─ db.js              ← Prisma client singleton
│  │  ├─ auth.js            ← JWT sign/verify, cookie, requireAdmin middleware
│  │  ├─ email.js           ← templates HTML + envío SMTP
│  │  └─ scheduler.js       ← recordatorios y inasistencias
│  ├─ routes/
│  │  ├─ auth.js            ← register / login / verify / logout / me
│  │  └─ admin.js           ← CRUD citas/ciudadanos/banners/usuarios/bitácora
│  ├─ public/
│  │  ├─ login.html
│  │  ├─ admin.html         ← SPA-lite del panel
│  │  └─ images/
│  └─ config/
│     └─ settings.json
├─ docs/                    ← este documento + manuales (markdown → PDF)
└─ entregable/              ← PDF institucional
```

---

## 4. Modelo de datos (Prisma → MongoDB)

### `Citizen`
Ciudadano registrado o invitado. `email` único. Soporta cuentas "invitadas" creadas desde formulario público (`esInvitado=true`) sin password.

Campos: `id`, `nombre`, `apellido`, `email` (unique), `password?`, `telefono?`, `cedula?`, `tipoDocumento?`, `esInvitado`, `verified`, `verifyCode?`, `verifyExpiry?`, `createdAt`, `updatedAt`.

### `AdminUser`
Staff del consulado.

Campos: `id`, `nombre`, `email` (unique), `password` (bcrypt), `role` (`superadmin` | `consul` | `asistente`), `cargo?`, `permisos[]`, `buzonLastRead?`.

`permisos[]` controla acceso por módulo: `dashboard`, `ciudadanos`, `banners`, `fechas_bloqueadas`, `citas`, `usuarios`.

### `Appointment`
Cita consular. Vinculada a `Citizen` o con datos externos (cita anónima desde web).

Campos clave: `serial` (Ticket público, ej. `VCNE-2026-0001`, único), `citizenId?`, `nombreExterno?`, `emailExterno?`, `telefonoExterno?`, `cedulaExterno?`, `tipoDocumento?`, `fecha`, `hora`, `tramite`, `status`, `origen` (`'web'` | `'admin'`, default `'admin'`), `notas?`, `documentosPendientes?` (JSON array de strings), `recordatorioEnviado`, `valijaId?` (cuando el trámite se incluye en una valija diplomática).

Status: `pendiente` → `confirmada` → `en_proceso` → `asistencia_tarde` / `completada` / `cancelada` / `inasistencia`.

**Identificadores trazables** (sin datos personales):

| UI | Modelo | Formato | Cuándo se crea |
|----|--------|---------|----------------|
| **Ticket** | `Appointment.serial` | `VCNE-YYYY-NNNN` | Al crear la cita (público o panel). Se incluye en cada correo al ciudadano. |
| **Folio** | `Valija.serial` | `VAL-YYYY-NNNN` | Al ejecutar `POST /valijas/cerrar-dia`. Antes el Appointment tiene `valijaId=null` y la columna Folio aparece vacía en el panel. |

Ambos serial se generan atómicamente vía `Counter` (`$inc` MongoDB) por prefijo y año (`lib/serial.js → nextSerial(prefix)`).

### `Valija`
Bolsa diplomática que agrupa las citas *completadas* listas para enviar al Consulado General. Identificada por **Folio** (`serial`).

Estados: `abierta` → `enviada` → `recibida`. Cada transición a `enviada` o `recibida` dispara correo automático a todos los ciudadanos cuyos trámites están dentro de la valija (con correo registrado). El estado `abierta` es interno.

### `ActivityLog`
Auditoría inmutable de toda acción consular.

Campos: `tipo`, `citaId?`, `ciudadanoEmail?`, `mensajeCiudadano?`, `notaInterna?`, `datos?` (JSON string), `realizadoPor`, `createdAt`.

### `Banner`
Aviso público mostrado en web.

Campos: `categoria?`, `titulo`, `cuerpo`, `activo`, `orden`.

### `BlockedDate`
Fechas o franjas no disponibles para citas. Soporta clave `YYYY-MM-DD` (día completo) o `YYYY-MM-DD_HH:MM` (franja).

### `Setting`
Configuración dinámica clave-valor (usada por `/api/config`).

### `SessionLog` (nuevo)
Sesiones admin (volumen alto, queries específicas). Campos: `adminUserId?`, `email`, `nombre?`, `role?`, `tipo` (`login_ok` | `login_fail` | `logout` | `expirado`), `ip?`, `userAgent?`, `createdAt`.

### `TramiteMaestro` (nuevo)
Catálogo institucional de trámites. Campos: `codigo` (unique, ej. `PAS-PRIM`), `nombre`, `categoria?`, `descripcion?`, `requisitos[]`, `duracionEstimada?` (minutos), `activo`, `createdAt`, `updatedAt`. Sembrado vía `scripts/seed-tramites.js`.

### `ActivityLog` — extendido para auditoría 360°
Campos nuevos sobre la base existente: `realizadoPorId?`, `entidad?` (`cita` | `ciudadano` | `usuario_admin` | `banner` | `valija` | `fecha_bloqueada` | `sesion` | `reporte` | `setting`), `entidadId?`, `accion?` (`crear` | `editar` | `eliminar` | `cambio_estado` | `login_ok` | `login_fail` | `logout` | `cambio_permisos` | `exportar`), `ip?`, `userAgent?`, `antes?` (JSON snapshot pre-cambio), `despues?` (JSON snapshot post-cambio). Índices: `(createdAt desc)`, `(entidad, createdAt)`, `(realizadoPorId, createdAt)`, `(ciudadanoEmail)`.

**Borrado de `ActivityLog`** (solo superadmin): `DELETE /api/admin/bitacora/:id` para entradas individuales y `DELETE /api/admin/bitacora?tipo=X&antesDe=YYYY-MM-DD` para purga masiva por filtro. Antes de cada borrado se registra una meta-entrada (`tipo='bitacora_eliminada'` o `'bitacora_purga'`) con snapshot de lo borrado, autor, IP y filtros, para evitar huecos silenciosos en la auditoría. La purga masiva exige al menos un filtro (`tipo` y/o `antesDe`) — no permite barrido total accidental. Los borrados por cascada técnica (eliminar cita o ciudadano) siguen pasando sin meta-auditoría individual.

**Política de sanitización**: el helper `lib/audit.js` aplica allowlist por entidad antes de serializar `antes`/`despues`. Campos `password`, `verifyCode`, `verifyExpiry`, `buzonLastRead` jamás se persisten en logs.

---

## 5. Endpoints

### Públicos (sin autenticación, sí con rate limit y CORS)

| Método | Ruta | Función |
|--------|------|---------|
| GET | `/api/config` | Devuelve todos los `Setting` como mapa |
| GET | `/api/banners` | Banners activos ordenados |
| GET | `/api/fechas-bloqueadas` | Fechas/franjas no disponibles |
| GET | `/api/public/verificar?cedula=X` o `?email=X` | ¿Existe ciudadano? |
| POST | `/api/public/cita` | Crear cita desde web pública. Valida fecha bloqueada y hora ocupada. Crea o vincula `Citizen` invitado. Envía email de confirmación. |
| POST | `/api/setup` | **Solo si no hay ningún admin todavía** — crea primer superadmin. |

### Auth (`/api/auth/*`, rate limit 10/15min)

| Método | Ruta | Función |
|--------|------|---------|
| POST | `/api/auth/register` | Registro ciudadano + envía código verificación |
| POST | `/api/auth/login` | Login admin o ciudadano (mismo endpoint, distingue por rol) |
| POST | `/api/auth/verify` | Confirma código (15 min validez) |
| POST | `/api/auth/logout` | Borra cookie |
| GET | `/api/auth/me` | Devuelve sesión actual |

### Admin (`/api/admin/*`, requiere rol admin)

**Stats:** `GET /api/admin/stats`

**Citas:** `GET /citas` (filtros: `fecha`, `status`, `mes`, `fechaDesde`/`fechaHasta`, `origen` ∈ `{web, admin}`), `POST /citas` (rechaza fecha ≤ hoy y S/D; marca `origen='admin'`), `PUT /citas/:id`, `POST /citas/:id/cancelar`, `POST /citas/:id/reagendar` (rechaza fecha ≤ hoy, valida día hábil L-V y conflicto de horario; dispara correo `reagendamiento`), `DELETE /citas/:id` (irreversible; **solo superadmin**; borra ActivityLogs asociados y registra una entrada `cita_eliminada` en la bitácora general).

`POST /api/public/cita` marca la cita con `origen='web'`. El campo `Appointment.origen` (default `'admin'`) permite filtrar y distinguir solicitudes ciudadanas de creaciones internas.

`POST /api/public/cita` (formulario público) también rechaza fecha ≤ hoy + S/D antes de tocar la base de datos.

**Valijas:** `GET /valijas`, `GET /valijas/:id`, `POST /valijas/cerrar-dia` (agrupa citas completadas), `POST /valijas/:id/enviar` (notifica a cada ciudadano: correo *valija enviada*), `POST /valijas/:id/recibir` (notifica a cada ciudadano: correo *en revisión*), `GET /valijas/:id/ticket` (HTML imprimible).

**Registro incompleto:** `GET /registro-incompleto`, `PATCH /registro-incompleto/:id/doc`, `POST /registro-incompleto/:id/finalizar`.

**Bitácora:** `GET /bitacora` (filtro `tipo`, `limit`), `POST /bitacora/leer-todo`.

**Ciudadanos:** `GET /ciudadanos` (paginado + búsqueda), `GET /ciudadanos/buscar`, `GET /ciudadanos/:id`, `PUT /ciudadanos/:id`, `DELETE /ciudadanos/:id` (irreversible, **solo superadmin**; bloquea si tiene citas asociadas salvo `?force=true`, que cascada borrando todas sus citas + ActivityLogs y registra una entrada `ciudadano_eliminado` en la bitácora general).

**Banners:** CRUD completo.

**Fechas bloqueadas:** `GET`, `POST`, `DELETE`.

**Usuarios admin** (solo superadmin): CRUD con validación de módulos permitidos. Cada operación se audita con `entidad='usuario_admin'`, captura `antes`/`despues` (sin password) y diferencia `accion='cambio_permisos'` cuando varían `role` o `permisos[]`.

**Transaccionales específicas para gestor** — además del log general, las altas y bajas de personal con rol `asistente` (acceso operativo) emiten una entrada dedicada:

- `tipo='gestor_alta'`, `accion='alta_gestor'`: al crear un usuario con role=asistente o al cambiar el rol de un usuario existente a asistente.
- `tipo='gestor_baja'`, `accion='baja_gestor'`: al eliminar un usuario con role=asistente o al cambiar su rol fuera de asistente.

Razón: aislar en la bitácora los eventos delicados (entrada y salida de personal con acceso al panel) para reporting institucional y reconciliación de accesos.

`MODULOS_VALIDOS = ['dashboard', 'ciudadanos', 'banners', 'fechas_bloqueadas', 'citas', 'usuarios', 'valijas', 'crm', 'buzon', 'reporteria_ciudadanos', 'reporteria_citas', 'reporteria_maestro', 'reporteria_auditoria']`.

### Reportería — acceso granular por reporte

Cada uno de los 4 reportes tiene su permiso fino independiente. Middleware `requirePermiso(perm)` por endpoint:

| Reporte | Permiso requerido |
|---|---|
| Ciudadanos (listar/export) | `reporteria_ciudadanos` |
| Citas (listar/export) | `reporteria_citas` |
| Maestro (listar/export) | `reporteria_maestro` |
| Auditoría + Sesiones (listar/export) | `reporteria_auditoria` |

Superadmin pasa siempre. Para roles `consul` y `asistente`, el middleware lee `permisos[]` de BD por sesión (no depende del JWT).

**Frontend**: el tab "Reportería" en el sidebar aparece si el usuario tiene **al menos un** permiso `reporteria_*`. Dentro del tab, cada card lanzadora se muestra/oculta individualmente según el permiso fino correspondiente.

Permiso `reporteria_auditoria` se marca como **sensible** en el modal de Editar usuario (contiene rastro de sesiones, IPs y cambios de configuración del panel).

### Reportería (`/api/admin/reportes/*`, **solo superadmin**)

| Endpoint | Función |
|---|---|
| `GET /reportes/ciudadanos` | Padrón paginado con filtros (q, tipoDocumento, verified, esInvitado, desde, hasta) |
| `GET /reportes/ciudadanos/export` | XLSX completo del filtro |
| `GET /reportes/citas` | Citas paginadas con filtros (status, origen, tramite, ciudadano, valijaSerial, rangos de fecha cita y fecha solicitud) + resumen por estado |
| `GET /reportes/citas/export` | XLSX completo del filtro |
| `GET /reportes/maestro` | Catálogo `TramiteMaestro` + volumetría (30d, año) |
| `GET /reportes/maestro/export` | XLSX con dos hojas: principal + Requisitos desnormalizados |
| `GET /reportes/auditoria` | `ActivityLog` paginado con filtros (entidad, accion, realizadoPor, ciudadanoEmail, ip, rango fecha) |
| `GET /reportes/auditoria/export` | XLSX con dos hojas: Auditoría + Sesiones admin |
| `GET /reportes/auditoria/sesiones` | `SessionLog` paginado (filtros email, tipo, rango) |

Cada `*/export` genera un `ActivityLog` con `entidad='reporte', accion='exportar'`, registrando el reporte solicitado, filtros aplicados y nº de filas. Trazabilidad de quién extrae qué.

---

## 6. Seguridad

- **JWT** firmado con `JWT_SECRET`. Cookie httpOnly, `secure` en producción, `sameSite=lax`, 7 días.
- **bcrypt** cost 12 para passwords.
- **Rate limit:** login 10 req / 15 min, API 120 req / 60s.
- **CORS** allowlist explícita (`server.js:21-31`).
- **WAF-lite path blocker:** rechaza paths con `wp-`, `.env`, `.git`, `xmlrpc`, `sitemap`, `etc/passwd`, traversal.
- **Redirect HTTP→HTTPS** (server.js): en `NODE_ENV=production`, cualquier petición con `x-forwarded-proto=http` se 301-redirige a `https://`.
- **CSP** estricta (`default-src 'self'`, allowlist explícita para cdn.jsdelivr.net / fonts.googleapis.com / api.resend.com).
- **Cookie de sesión** con `sameSite=strict` en producción (`lax` en dev).
- **Setup endpoint** bloqueado tras crear primer admin.
- **Roles** validados en `requireAdmin` (lib/auth.js); `requireSuperadmin` adicional para gestión de usuarios.
- **Auditoría** en cada acción mutativa vía `ActivityLog`.
- **Conflicto de horario** validado en `POST /citas`, `PUT /citas/:id` y `POST /api/public/cita`.

**Pendientes hardening producción:**
- Rotar `JWT_SECRET` a 64 bytes random.
- Añadir `helmet` (CSP, HSTS, X-Frame-Options).
- Añadir CAPTCHA o honeypot en formulario público.
- Logs centralizados (winston + rotación).
- Mongo con TLS + usuario dedicado read/write.

---

## 7. Variables de entorno

```bash
# admin/.env
DATABASE_URL="mongodb+srv://USER:PASS@CLUSTER/viceconsul?retryWrites=true&w=majority"
JWT_SECRET="<64 bytes random hex>"
GMAIL_USER="viceconsuladomargarita@gmail.com"
GMAIL_PASS="<app password 16 chars>"
PORT=3000
NODE_ENV=production   # solo en server real
```

**Generar JWT_SECRET fuerte:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 8. Arranque local

```bash
cd admin
npm install
# Editar .env con DATABASE_URL Mongo real
npx prisma generate
npx prisma db push --accept-data-loss   # crea índices en Mongo
node server.js
```

Abrir http://localhost:3000 → redirige a login.

**Primera vez:** llamar `POST /api/setup` con `{nombre, email, password}` para crear superadmin (luego el endpoint se autobloquea).

---

## 9. Despliegue en servidor dedicado (plan)

1. Ubuntu 22.04 LTS, 2-4 vCPU, 4-8 GB RAM.
2. Crear usuario `viceconsul` (no root).
3. Instalar Node LTS, nginx, certbot, fail2ban, ufw.
4. `ufw allow 22,80,443`; `ssh` solo por clave.
5. Clonar repo, `npm ci --production`.
6. Variables en `/etc/viceconsul.env` (`chmod 600`, owner `viceconsul`).
7. systemd unit `/etc/systemd/system/viceconsul.service`:
   ```ini
   [Unit]
   Description=Viceconsul Admin
   After=network.target
   [Service]
   User=viceconsul
   WorkingDirectory=/home/viceconsul/viceconsul/admin
   EnvironmentFile=/etc/viceconsul.env
   ExecStart=/usr/bin/node server.js
   Restart=on-failure
   [Install]
   WantedBy=multi-user.target
   ```
8. nginx reverse proxy → `127.0.0.1:3000`, Let's Encrypt cert.
9. `logrotate` para logs Node y nginx.
10. UptimeRobot pinging `/api/auth/me` (devuelve 401 si OK).
11. Backup diario Mongo + snapshot disco.

---

## 10. Scheduler (recordatorios e inasistencias)

`lib/scheduler.js` corre cada 60 segundos:

1. **Recordatorio:** envía email a citas de hoy entre 55-65 min antes de la hora. Marca `recordatorioEnviado=true` para no repetir.
2. **Inasistencia automática:** citas hoy en `pendiente`/`confirmada` cuya hora ya pasó +20 min → status `inasistencia` + email + log con nota "⚠️ Debe rodarse la plaza".

⚠️ Comentario en código dice "30 min" pero el código usa `+20`. Definir regla oficial y unificar.

---

## 11. Cambios recientes (git log)

- `feat(admin)`: folio visible en lista de citas (sin botón "ver ticket"), correo dedicado de reagendamiento, correo automático al marcar valija *enviada*, WhatsApp con preámbulo contextual (nombre + folio + evento) en todos los correos, picker de días hábiles (pills L-V) y validación server-side de S/D en reagenda.
- `90a0d74` feat(admin): script para crear usuario demo (rol asistente, sin gestion de usuarios)
- `17bce42` security: eliminar referencias 'sigo' visibles en view-source
- `f1d572a` feat(admin): Valija Diplomatica + folio (serial) por cita
- `54208c8` fix(admin): hardening pre-demo
- `5994d25` fix(email): quitar BCC al gmail interno; controlable por MAIL_BCC
- `514899b` fix(email): contacto/Reply-To usa el gmail del consulado, sin @maec.es
- `ad93fdf` feat(admin): envio por Resend (HTTPS) como via principal

---

## 12. Pendientes técnicos críticos

| # | Tarea | Bloquea |
|---|-------|---------|
| 1 | Connection string MongoDB real en `.env` | Arranque local |
| 2 | Gmail App Password para `viceconsuladomargarita@gmail.com` | Envío de emails reales |
| 3 | Renombrar variables `GMAIL_*` → `SMTP_*` o decidir único proveedor | Claridad operativa |
| 4 | Rotar `JWT_SECRET` a 64 bytes random | Producción |
| 5 | Rotar PAT GitHub leakeados | Seguridad |
| 6 | Añadir `helmet` + CAPTCHA | Producción |
| 7 | Unificar regla inasistencia (20 vs 30 min) | Operativa |
| 8 | Migrar de Railway a servidor dedicado | Disponibilidad |

---

## 13. Convenciones

- Commits: `tipo: descripción corta` (`fix:`, `feat:`, `chore:`, `docs:`, `refactor:`).
- Rama principal: `master`.
- Idioma código: español en modelos/rutas (terminología consular).
- Logs por consola: prefijo `[Scheduler]`, `[email]`, etc.
