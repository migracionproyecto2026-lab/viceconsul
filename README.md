# Viceconsulado de Venezuela en Porlamar

Sistema web del Viceconsulado de Venezuela en la Isla de Margarita. Permite a los ciudadanos solicitar citas consulares desde la web pública y al personal gestionarlas desde un panel administrativo.

---

## Arquitectura

```
web/  (HTML estático)          admin/  (Express + API REST)
GitHub Pages          ──────▶  Railway
                                  │
                               MongoDB Atlas
                            (base de datos compartida)
```

- **`web/`** — sitio público en HTML/CSS/JS estático. Se despliega automáticamente a GitHub Pages cuando hay cambios en `web/` sobre la rama `master`.
- **`admin/`** — servidor Express que expone la API REST y sirve el panel de gestión como HTML estático desde `/public`. Se despliega en Railway.
- **MongoDB Atlas** — base de datos compartida. La cadena de conexión se inyecta como variable de entorno en Railway.

---

## Variables de entorno

Las variables van en `admin/.env` (local) o en Railway → Variables (producción).

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Connection string de MongoDB Atlas (`mongodb+srv://...`) |
| `JWT_SECRET` | Sí | Clave secreta para firmar los tokens de sesión |
| `PORT` | No | Puerto del servidor (Railway lo asigna automáticamente) |
| `GMAIL_USER` | No | Correo Gmail para envío de notificaciones |
| `GMAIL_PASS` | No | Contraseña de aplicación de Gmail |

Copia `admin/.env.example` como punto de partida:

```bash
cp admin/.env.example admin/.env
```

---

## Quick-start local

```bash
# 1. Instalar dependencias
cd admin
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL y JWT_SECRET

# 3. Sincronizar el schema con la base de datos
npx prisma db push

# 4. Arrancar el servidor
npm run dev
```

El servidor queda en `http://localhost:3000`.
El panel admin en `http://localhost:3000/admin`.

> **Primer uso:** usa el endpoint `POST /api/setup` para crear el primer usuario superadmin (ver `admin/README.md`).

---

## URLs de producción

| Entorno | URL |
|---|---|
| Web pública | https://migracionproyecto2026-lab.github.io/viceconsul/ |
| Panel admin | https://viceconsul-production-xxxx.up.railway.app *(pendiente deploy)* |

---

## Deploy en Railway

1. Dashboard Railway → servicio `viceconsul` → **Settings → Source → Root Directory:** `admin`
2. **Variables** → agregar `DATABASE_URL`, `JWT_SECRET`, `PORT=3000`
3. **Redeploy** → el arranque corre `prisma db push` y luego `node server.js`

---

## Estructura del repositorio

```
viceconsul/
├── web/              # Sitio público HTML estático
│   ├── index.html
│   └── ...
├── admin/            # Panel administrativo (Express + API)
│   ├── server.js     # Entrada principal
│   ├── routes/       # auth.js, admin.js
│   ├── lib/          # db, auth, email, scheduler
│   ├── prisma/       # schema.prisma (MongoDB)
│   ├── public/       # Panel HTML servido por Express
│   └── start.sh      # Script de arranque en Railway
└── .github/
    └── workflows/
        └── deploy-web.yml   # CI/CD → GitHub Pages
```
