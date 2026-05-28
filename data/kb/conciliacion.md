# Conciliación KB ↔ fuentes oficiales

Análisis comparativo entre la información de **`viceconsulado-nuevaesparta.com`** y las fuentes oficiales del Ministerio (`exteriores.gob.es`) y el **Consulado General en Caracas**. Estado: 2026-05-27.

## Fuentes oficiales referenciadas

- **MAEC España**: <https://www.exteriores.gob.es>
- **Consulado General Caracas (oficial)**: <https://www.exteriores.gob.es/Consulados/caracas/es/Paginas/index.aspx>
- **Servicios consulares Caracas**: <https://www.exteriores.gob.es/Consulados/caracas/es/ServiciosConsulares/Paginas/index.aspx>
- **Tasas consulares**: <https://www.exteriores.gob.es/Consulados/caracas/es/Consulado/Paginas/Tasas-consulares.aspx>
- **Verificación estado de trámite**: <https://sutramiteconsular.maec.es>
- **Hojas declaratorias oficiales** (PDF MAEC): nacimiento, matrimonio, defunción (links en `tramites.json`).
- **Viceconsulado par (referencia)**: <https://citas-consulado-honorario-de-espana-en-barquisimeto.webnode.es/>

## Conciliación trámite por trámite

| Trámite | Nuestra web | Caracas/MAEC | Conciliación |
|---|---|---|---|
| **Pasaportes — Primera expedición** | Lista 5 requisitos; presencial; menores con padre+madre | MAEC mantiene los mismos requisitos a nivel nacional | ✅ Consistente |
| **Pasaportes — Renovación, < 12 años** | Sin huellas, en Margarita | Política MAEC: huellas obligatorias ≥ 12 años | ✅ Consistente |
| **Pasaportes — Renovación, ≥ 12 años** | Inicio aquí, huellas en Caracas u operativo | Igual | ✅ Consistente |
| **Inscripción Nacimiento** | Gratuito, Hoja declaratoria MAEC + apostilla, plazos 2-6 meses Caracas | Idem MAEC | ✅ Consistente |
| **Inscripción Matrimonio** | Gratuito, Libro de Familia, ambos contrayentes | Idem MAEC | ✅ Consistente |
| **Inscripción Defunción** | Familiar directo, hoja declaratoria MAEC | Idem MAEC | ✅ Consistente |
| **Fe de Vida** | Cert. médico ≤ 3 meses + pasaporte español + cédula | Idem práctica habitual MAEC | ✅ Consistente |
| **Poderes notariales** | Se inician aquí, **firma obligatoria en Caracas** | Idem | ✅ Consistente |
| **Antecedentes penales** | Solicitud aquí, retiro en Min. Justicia España | Idem | ✅ Consistente |
| **NIF / NIE** | Se realizan aquí | Posible para residentes; MAEC también los gestiona desde Caracas | ✅ Consistente |
| **Visados (turista, estudio, trabajo, reagrupación)** | NO se realizan aquí | Competencia exclusiva del Consulado General | ✅ Consistente |
| **Compulsas, Apostilla, Legalizaciones** | NO se realizan aquí | Competencia exclusiva del Consulado General | ✅ Consistente |
| **Homologaciones de títulos** | NO se realizan aquí | Competencia exclusiva del Consulado General | ✅ Consistente |
| **Certificados plurilingües** | Matrimonio, Nacimiento (Convenio de Viena) | Convenio de Viena vigente | ✅ Consistente |

## Brechas detectadas (mejoras sugeridas, no contradicciones)

1. **Tasas consulares concretas no se publican aquí.** El usuario hace clic a la página de Caracas para verlas. **Mejora:** sincronizar las tasas actuales de los pocos trámites con tasa (pasaportes) en `tramites.json` para que el chatbot las pueda decir directo, citando la fecha de actualización y el link oficial como fuente.
2. **No hay enlace público a la Hoja Declaratoria de Defunción descargable local.** Solo MAEC. Coherente, pero el chatbot puede ofrecer el link MAEC directamente.
3. **Pasaporte — coste por categoría (mayor/menor edad, primera/renovación)**: hoy redirige a la tabla MAEC. Estructurarlo en KB facilita responder "¿cuánto cuesta renovar el pasaporte?".
4. **Cambios estacionales (jornadas de huellas en Margarita)**: hoy se anuncian por banner. Mejora: incluir en KB un campo `eventos_proximos` actualizable, y consumirlo desde el chatbot como respuesta a "¿cuándo es la próxima jornada?".
5. **Trámites que requieren cita SOLO en Caracas** (visados, apostillas): añadir al bot un mensaje educativo con el link oficial, sin atender directamente.

## Marco normativo

Toda la información operada por el Viceconsulado se rige por:
- **Real Decreto 1390/2007** (registro consular).
- **RGPD (UE) 2016/679** — base jurídica: misión de interés público + obligación legal.
- **LOPDP Venezuela** (Decreto Constituyente 2021).

## Cambios futuros

Cualquier reforma normativa o de competencias **debe reflejarse primero en la web pública aprobada**, y luego regenerar la KB para que el chatbot quede sincronizado. La autoridad final es la web pública aprobada por la jurisdicción consular.
