# Manual del Usuario — Panel del Viceconsulado

**Para: personal del Viceconsulado Honorario de España en Nueva Esparta.**
Última actualización: 2026-05-28

---

## 1. ¿Qué es el panel?

Es la herramienta interna para gestionar las citas, los ciudadanos y los avisos públicos del Viceconsulado. Sustituye a las hojas de cálculo y al control manual de citas.

Lo que puede hacer:

- Ver las citas del día, de la semana o de un mes completo.
- Crear, reagendar o cancelar citas (con aviso automático por correo al ciudadano).
- Ver el historial de cada ciudadano y sus citas anteriores.
- Publicar avisos en la web pública (banners).
- Bloquear días o franjas horarias (festivos, jornadas especiales).
- Recibir un buzón con todas las novedades (nuevas citas, cancelaciones, ausencias).
- Solo el superadministrador: crear o eliminar usuarios del panel.

---

## 2. Entrar al panel

1. Abrir el navegador en la dirección del panel (la que indique el administrador).
2. Introducir el correo y la contraseña que le entregaron.
3. Pulsar **Entrar**.

> ⚠️ Si la contraseña falla 10 veces seguidas, el sistema bloquea los intentos durante 15 minutos para evitar accesos no autorizados.

---

## 3. Pantalla principal (Dashboard)

Verá tarjetas con:

- **Ciudadanos registrados** — total y cuántos verificaron su correo.
- **Citas pendientes** — sin confirmar todavía.
- **Citas hoy** — agenda del día.
- **Citas esta semana** — vista rápida.
- **Documentos pendientes** — citas que entregaron solo parte de la documentación.
- **Buzón sin leer** — actividad reciente que necesita su atención.

---

## 4. Gestión de citas

### Ver citas
En el menú **Citas** verá la lista. Las dos primeras columnas son los identificadores del trámite:

- **Ticket** (ej. `VCNE-2026-0001`) — identificador único del trámite del ciudadano. Se genera **en el momento de crear la cita** y se le envía por correo. Cada ciudadano recibe un ticket distinto por cada trámite que solicita.
- **Folio** (ej. `VAL-2026-0001`) — identificador de la **valija diplomática** que contiene este trámite. Aparece vacío (`—`) hasta que se ejecuta **Cerrar día** y el trámite queda agrupado en una valija.

Ningún identificador contiene datos personales del ciudadano.

Puede filtrar por:
- fecha exacta
- estado (pendiente, confirmada, completada, cancelada, inasistencia)
- mes
- rango de fechas

### Crear una cita
1. Botón **Nueva cita**.
2. Buscar al ciudadano por correo, cédula o nombre. Si no existe, rellene los datos como cita externa.
3. Elegir fecha (solo lunes a viernes) y hora.
4. Seleccionar el trámite.
5. Añadir notas si hace falta.
6. **Guardar.**

El sistema avisa por correo al ciudadano automáticamente.

### Reagendar
Dentro de la cita: botón **Reagendar** → elegir nueva fecha/hora.

- En la ventana aparecen **pills** con los próximos 10 días hábiles (L-V). Hacer clic en uno selecciona la fecha automáticamente.
- También se puede usar el selector de fecha tradicional, pero solo acepta lunes a viernes: si elige sábado o domingo, el sistema rechaza la selección.
- Si la plaza original **no** se libera (por ejemplo, otra persona la usará), marcar la opción y poner motivo.
- Al confirmar, el ciudadano recibe un correo dedicado de **reagendamiento** indicando la fecha anterior y la nueva.

### Cancelar
Botón **Cancelar**. Puede añadir un mensaje al ciudadano (se incluye en el correo) y una nota interna (solo para el equipo).

### Registrar inasistencia
Cambiar estado a **inasistencia**. El ciudadano recibe correo automático.
*El sistema también lo hace automático 20 minutos después de la hora si no se cambió a otro estado.*

### Documentos pendientes
Si una cita necesita papeles adicionales, marcarlos en el campo correspondiente. Aparecerá en **Registro incompleto**. Al recibir cada documento, tildarlo. Cuando no quede ninguno, marcar **Finalizar**.

---

## 5. Ciudadanos

Menú **Ciudadanos** → ver listado paginado o buscar por nombre, correo o cédula.

Para cada ciudadano puede ver:
- Datos personales
- Cuántas citas tiene
- Historial de las últimas 20 citas

Edición permitida: nombre, apellido, teléfono, cédula, tipo de documento, marcar como verificado manualmente.

---

## 6. Banners (avisos en la web pública)

Menú **Banners** → estos textos aparecen en la página pública.

- **Crear:** título + cuerpo + categoría (opcional) + orden (qué tan arriba aparece).
- **Activar/desactivar:** un banner desactivado deja de mostrarse.
- **Borrar:** elimina definitivamente.

> Use esto para anuncios oficiales: cambios de horario, jornadas especiales, requisitos nuevos.

---

## 7. Fechas bloqueadas

Menú **Fechas bloqueadas** → los ciudadanos no podrán pedir cita en estos días.

- Bloquear día completo: introducir `2026-07-15` y un motivo (ej. "Festivo Día de la Virgen del Carmen").
- Las fechas bloqueadas se reflejan inmediatamente en el formulario público.

---

## 8. Bitácora (historial de actividad)

Menú **Bitácora** → ver todas las acciones realizadas:
- Creación de citas
- Cancelaciones
- Reagendamientos
- Inasistencias
- Documentos recibidos

Filtros por tipo y límite de resultados.

Al abrir el buzón, pulsar **Marcar todo como leído** para resetear el contador.

---

## 9. Usuarios (solo Superadmin)

Menú **Usuarios** → crear/editar/eliminar cuentas del panel.

Roles:
- **Superadmin:** puede todo, incluido crear usuarios.
- **Cónsul:** acceso a todos los módulos operativos.
- **Asistente:** acceso solo a los módulos marcados en sus permisos.

Módulos asignables individualmente: dashboard, ciudadanos, banners, fechas bloqueadas, citas, usuarios.

> ⚠️ Un superadmin no puede borrarse a sí mismo ni cambiarse el rol. Pida a otro superadmin que lo haga.

---

## 10. Correos automáticos

El sistema envía automáticamente:

| Cuándo | Quién recibe | Asunto |
|--------|--------------|--------|
| Registro nuevo | Ciudadano | Código de verificación |
| Solicitud de cita creada | Ciudadano | Solicitud recibida [ticket] |
| Cita confirmada por el equipo | Ciudadano | Cita confirmada [ticket] |
| Cita reagendada por el equipo | Ciudadano | Cita reagendada [ticket] |
| 1 hora antes | Ciudadano | Recordatorio de cita |
| Cancelación | Ciudadano | Cancelación de cita [ticket] |
| Inasistencia | Ciudadano | Registro de inasistencia [ticket] |
| Valija marcada **enviada** | Cada ciudadano dentro de la valija | Su trámite ha sido enviado al Consulado General |
| Valija marcada **recibida** | Cada ciudadano dentro de la valija | Su trámite está en revisión |

Los correos referencian al **Ticket** del trámite. Los correos de valija añaden además el **Folio** de la valija que viaja al Consulado General.

Cada correo incluye un botón de **WhatsApp** con un mensaje pre-rellenado que ya menciona el nombre del ciudadano y el folio del trámite, para que el contacto sea más rápido.

Si un correo no llega: revisar carpeta de spam del ciudadano y comprobar con el administrador si el servicio de correo está activo.

---

## 10.bis Valija diplomática

Menú **Valijas** → módulo de control de los trámites que el Viceconsulado remite al Consulado General de Caracas.

Ciclo de vida de una valija:

1. **Abierta** — al cerrar el día (botón **Cerrar día**) se agrupan todas las citas con estado *completada* que aún no están en ninguna valija. Se genera un serial único de valija (`VAL-2026-NNNN`).
2. **Enviada** — al pulsar el botón de envío:
   - La valija pasa a estado *enviada* y queda marcada con la fecha de salida.
   - **Se envía automáticamente un correo a cada ciudadano** cuyo trámite va dentro de la valija, informando que su expediente ha salido hacia el Consulado General.
3. **Recibida** — al confirmar la recepción por parte del Consulado General:
   - La valija pasa a estado *recibida* y queda marcada con la fecha de recepción.
   - **Se envía automáticamente un correo a cada ciudadano** indicando que su trámite está en revisión.

> El **Folio** (serial de la valija, `VAL-AAAA-NNNN`) y los **Tickets** de los trámites (`VCNE-AAAA-NNNN`) son el registro institucional. No contienen datos personales por sí mismos.

---

## 11. Buenas prácticas

- Confirmar siempre la cita el día antes (cambia estado de **pendiente** a **confirmada**).
- Rellenar las notas internas con cualquier dato relevante (idioma del ciudadano, documentación especial, etc.). Solo el equipo las ve.
- Bloquear días festivos al inicio del año.
- Revisar la bitácora cada mañana.
- Cambiar la contraseña personal cada 90 días.

---

## 12. Si algo no funciona

1. Cerrar sesión y volver a entrar.
2. Refrescar el navegador (F5).
3. Probar en modo incógnito.
4. Avisar al administrador con: qué hacía, qué error apareció, captura de pantalla.

Contacto de soporte técnico: el administrador del proyecto.
