# Base de Conocimiento (KB) — Viceconsulado Honorario Nueva Esparta

Insumo estructurado para integraciones (chatbot WhatsApp, asistente web, IVR). Toda la información proviene de fuentes oficiales: la **web pública del Viceconsulado** (aprobada por las autoridades) y los **enlaces a `exteriores.gob.es`**.

## Archivos

| Archivo | Contenido | Volumen |
|---|---|---|
| `tramites.json` | Catálogo de trámites con requisitos, notas, competencia, opciones de cita y enlaces a documentos oficiales. | 7 grupos (PAS, NAC, MAT, DEF, FEV, OTR) + 4 trámites NO realizados aquí |
| `faq.json` | Preguntas frecuentes con respuesta corta y larga + `intents` (frases típicas para detectar la pregunta). | 10 |
| `contacto.json` | Datos institucionales del Viceconsulado y del Consulado General en Caracas, horarios, canales, links MAEC. | — |
| `conciliacion.md` | Análisis comparativo con exteriores.gob (fuentes oficiales) y notas operativas. | — |

## Convención de campos

- `id`: clave estable en kebab-case o snake_case. **No cambiar** una vez en uso por el bot.
- `competencia`: dónde se ejecuta cada parte del trámite:
  - `viceconsulado` — íntegro en sede de Porlamar.
  - `viceconsulado_recibe_caracas_registra` — documentos se reciben aquí; el registro civil lo asienta Caracas.
  - `viceconsulado_inicia_caracas_completa` / `viceconsulado_inicia_caracas_firma` — caso pasaporte huellas / poderes notariales.
  - `viceconsulado_solicita_min_justicia_es_retira` — antecedentes penales (retiro en Ministerio de Justicia España).
- `con_cita: true` significa que requiere cita previa en línea o por WhatsApp.
- `gratuito` / `tasa_aplicable`: economía del trámite.
- `presencial_obligatorio*`: si exige presencia física (y de quiénes).

## Uso desde un chatbot

```js
const tramites = require('./tramites.json')
const faq = require('./faq.json')
const contacto = require('./contacto.json')

// Encontrar un trámite por id
const pas = tramites.tramites.find(t => t.id === 'pasaportes')

// Buscar FAQ por intención
const intent = entrada.toLowerCase()
const respuesta = faq.faqs.find(f => f.intents.some(k => intent.includes(k)))
```

## Mantenimiento

Cuando cambien requisitos en la web pública, **regenerar estos archivos** desde `web/index.html` (sección Trámites y FAQ). La regla dura del proyecto es: la **fuente de verdad** es la web pública; la KB es su reflejo estructurado.

Si un trámite cambia su competencia (p. ej. Madrid centraliza algo), reflejarlo aquí y en la web pública con autorización previa.
