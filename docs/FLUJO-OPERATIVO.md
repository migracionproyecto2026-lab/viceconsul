# Flujo Operativo Consular — Viceconsulado Honorario de España en Nueva Esparta

**Documento institucional. Uso interno y para auditorías.**
Última actualización: 2026-05-28

---

## 1. Identificación institucional

- **Institución:** Viceconsulado Honorario de España en Nueva Esparta.
- **Dependencia:** Consulado General de España en Caracas → Embajada de España en Venezuela → Ministerio de Asuntos Exteriores, Unión Europea y Cooperación (MAEC).
- **Sede:** Porlamar, Estado Nueva Esparta, Venezuela.
- **Jurisdicción:** Isla de Margarita, Isla de Coche y demás islas del archipiélago de Nueva Esparta.
- **Horario público:** Lunes a Viernes, 8:00 – 12:00.
- **Correo oficial:** ch.porlamar@maec.es
- **WhatsApp ciudadanía:** +58 424-8429665
- **Sitio oficial:** publicado en GitHub Pages, dominio configurado en `web/CNAME`.

---

## 2. Aprobación institucional

La presencia web actual cuenta con la aprobación de:
- Cónsul General de España en Venezuela.
- Embajador de España en Venezuela.
- Vicecónsules del distrito consular.
- Otras autoridades políticas vinculadas al MAEC.

**Implicación operativa:** la imagen pública (sitio web, textos institucionales, marca) **no se modifica sin nueva aprobación**. Cambios en el panel administrativo no requieren reaprobación siempre que no alteren la experiencia del ciudadano.

---

## 3. Trámites cubiertos

El sistema gestiona citas para los trámites consulares competencia del Viceconsulado Honorario. Catálogo de referencia (ajustable desde el panel sin cambios de código):

- **Pasaportes** — solicitud, renovación, jornadas extraordinarias.
- **Inscripción de matrimonio** en el Registro Civil Consular.
- **Inscripción de nacimiento.**
- **Fe de vida y estado.**
- **Certificados consulares** (de residencia, de inscripción, etc.).
- **Legalizaciones y compulsas** dentro de la competencia honoraria.
- **Información y orientación general** sobre trámites no realizables en el viceconsulado (derivación al Consulado General de Caracas).

> ⚠️ Algunos trámites están reservados al Consulado General (DNI, visados, ciertas legalizaciones). En esos casos el sistema debe ofrecer información de derivación, no agendar cita.

---

## 4. Ciclo de vida de una cita

```
        ┌──────────────┐
        │ Solicitud    │  ← ciudadano via web pública o personal del consulado
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ pendiente    │  ← creada, aún no validada por staff
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ confirmada   │  ← staff revisó y confirmó
        └──────┬───────┘
               ▼
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌──────────────────┐
│ en_proceso  │  │ asistencia_tarde │
└──────┬──────┘  └────────┬─────────┘
       ▼                  ▼
       └──────────┬───────┘
                  ▼
           ┌─────────────┐
           │ completada  │  ← trámite atendido
           └─────────────┘

  Estados terminales alternativos:
  - cancelada  (por staff o ciudadano)
  - inasistencia (automática 20 min después de hora, o manual)
```

Toda transición queda registrada en **bitácora** (`ActivityLog`) con autor, fecha y nota.

**Folio de la cita.** Cada cita recibe al crearse un folio único (`VCNE-YYYY-NNNN`). El folio se entrega al ciudadano en cada correo y se usa como referencia institucional. **El folio no contiene ningún dato personal**; por sí solo no permite identificar al ciudadano.

---

## 4.bis Valija diplomática

Cada trámite **completado** en el Viceconsulado se agrupa, al cierre del día, en una **valija** (serial `VAL-YYYY-NNNN`) que se remite al Consulado General de España en Caracas.

```
        ┌──────────────┐
        │ abierta      │  ← se genera al cerrar el día con los trámites del día
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ enviada      │  ← sale del viceconsulado → correo a cada ciudadano
        └──────┬───────┘
               ▼
        ┌──────────────┐
        │ recibida     │  ← Consulado General confirma → correo a cada ciudadano
        └──────────────┘
```

- Solo las transiciones a **enviada** y **recibida** generan notificación al ciudadano.
- Cualquier evaluación interna antes de marcar como recibida ocurre fuera del sistema; al tildar el estado se asume confirmación oficial y se dispara el envío.

---

## 5. Canales y comunicaciones automáticas

| Evento | Canal | Destino | Acción |
|--------|-------|---------|--------|
| Solicitud de cita desde web | Email | Ciudadano | Confirmación inmediata (folio asignado) |
| Cita confirmada por el equipo | Email | Ciudadano | Notificación con folio |
| Cita reagendada por el equipo | Email | Ciudadano | Correo de reagendamiento con fecha anterior y nueva |
| 1 hora antes de la cita | Email | Ciudadano | Recordatorio |
| Cancelación | Email | Ciudadano | Notificación con motivo opcional |
| Inasistencia | Email | Ciudadano | Registro de inasistencia |
| Valija marcada **enviada** | Email | Cada ciudadano de la valija | Notificación de envío al Consulado General |
| Valija marcada **recibida** | Email | Cada ciudadano de la valija | Notificación de trámite en revisión |
| Verificación cuenta | Email | Ciudadano | Código 6 dígitos, expira 15 min |
| Cualquier acción administrativa | Bitácora interna | Staff | Buzón con badge "sin leer" |

Todos los correos al ciudadano incluyen botón **WhatsApp** con mensaje pre-rellenado: saludo con el nombre del ciudadano, referencia al folio y al tipo de evento (confirmación, cancelación, reagendamiento, etc.). Facilita la atención telefónica/chat sin obligarle a explicar de qué se trata.

Remitente actual: SMTP Office365 desde `ch.porlamar@maec.es` (migrando a Gmail dedicado).

---

## 6. Protección de datos (RGPD + LOPDP Venezuela)

**Datos personales tratados:**
- Nombre, apellido, email, teléfono, cédula, tipo de documento, fecha de la cita y trámite solicitado.

**Bases jurídicas:**
- Ejecución de funciones consulares (interés público).
- Consentimiento del ciudadano al solicitar cita en línea (formulario web).

**Política publicada:** `web/politica-privacidad.html` y `web/aviso-legal.html` (ya online y aprobadas).

**Medidas técnicas:**
- Contraseñas con bcrypt cost 12 (no recuperables, solo se restablecen).
- Sesiones con cookie httpOnly + JWT firmado.
- Datos en MongoDB (próximamente con TLS + usuario dedicado).
- Acceso al panel solo por roles definidos.
- Auditoría inmutable de cada acción.
- Rate limiting contra fuerza bruta.

**Pendiente para cumplimiento pleno (antes producción):**
- Banner cookies si se añade analítica.
- Procedimiento documentado de ejercicio de derechos ARCO/SUPP.
- Acuerdo de tratamiento si se contrata proveedor externo (Mongo Atlas, Gmail Workspace).

---

## 7. Disponibilidad y continuidad

**Web pública:** GitHub Pages — alta disponibilidad, sin coste, sin SLA pero estable.

**Panel admin:** se migrará a servidor dedicado (Ubuntu LTS) con:
- Snapshot diario, retención 7 días mínimo.
- Backup adicional de la base de datos.
- Monitoreo de disponibilidad (UptimeRobot).
- Reinicio automático (systemd Restart=on-failure).
- TLS Let's Encrypt con renovación automática.

**Procedimiento ante caída:**
1. Verificar monitoreo y logs.
2. Si servidor caído: reiniciar VPS / contactar proveedor.
3. Si DB caída: restaurar último backup.
4. Comunicar por WhatsApp y, si la caída supera 24 h, por correo oficial.
5. Registrar incidente en bitácora interna del Viceconsulado.

---

## 8. Roles y responsabilidades en el sistema

| Rol | Responsable típico | Permisos |
|-----|---------------------|----------|
| **Superadmin** | Vicecónsul Honorario o responsable TIC designado | Todo, incluido gestión de usuarios |
| **Cónsul** | Vicecónsul Honorario / staff superior | Operación completa salvo gestión usuarios |
| **Asistente** | Personal administrativo | Módulos asignados (dashboard, citas, ciudadanos, banners, fechas) |
| **Citizen** | Ciudadano externo | Solo su propia cuenta y sus citas |

Asignación de roles: estrictamente nominal. **No cuentas compartidas.**

---

## 9. Replicabilidad a otros viceconsulados

Este portal está diseñado para ser modelo replicable. Para adaptar a otro viceconsulado honorario:

1. Cambiar textos institucionales en `web/` (sede, contacto, jurisdicción).
2. Reemplazar imágenes y CNAME por las del nuevo viceconsulado.
3. Ajustar configuración (`Setting` en DB) — horario, trámites, mensajes.
4. Generar instancia separada del admin (servidor + DB independientes) o multi-tenant (decisión de arquitectura futura).
5. Repetir aprobación institucional con autoridades de cada distrito consular.

---

## 10. Hitos del proyecto

| Fecha | Hito |
|-------|------|
| Anterior | Migración de repo a `migracionproyecto2026-lab` ✅ |
| Anterior | Aprobación cónsul/embajador de la web pública ✅ |
| 2026-05-20 | Auditoría técnica completa, memoria construida, docs generados |
| Pendiente | Configurar DB MongoDB real + Gmail App Password |
| Pendiente | Provisión servidor dedicado |
| Pendiente | Hardening seguridad (helmet, CAPTCHA, secretos rotados) |
| **2026-06-11** | **Deadline duro — todo operativo en producción** |

---

## 11. Contacto institucional

- Sede: Viceconsulado Honorario de España, Porlamar, Nueva Esparta, Venezuela.
- Correo: ch.porlamar@maec.es
- WhatsApp: +58 424-8429665
- Web: véase `web/CNAME` para dominio actual.

Para asuntos no competencia del viceconsulado honorario, derivar a Consulado General de España en Caracas.
