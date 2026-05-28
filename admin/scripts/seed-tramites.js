// Seed/upsert del catálogo TramiteMaestro con los trámites ya en uso.
// Idempotente: re-ejecutable, no duplica. No borra trámites que ya existan
// con código distinto.
//
// Uso: node admin/scripts/seed-tramites.js
const { prisma } = require('../lib/db')

const TRAMITES = [
  // Pasaportes
  { codigo: 'PAS-PRIM', nombre: 'Pasaporte — Primera expedición', categoria: 'Pasaportes', duracionEstimada: 30,
    descripcion: 'Solicitud de primer pasaporte español.',
    requisitos: ['Cédula o documento de identidad vigente', 'Acta de nacimiento literal', 'Certificado de nacionalidad española', 'Dos fotografías recientes 32x26 mm fondo blanco', 'Justificante de pago de la tasa'] },
  { codigo: 'PAS-RENOV', nombre: 'Pasaporte — Renovación', categoria: 'Pasaportes', duracionEstimada: 20,
    descripcion: 'Renovación del pasaporte español.',
    requisitos: ['Pasaporte anterior (vigente o caducado)', 'Cédula o documento de identidad', 'Dos fotografías recientes 32x26 mm fondo blanco', 'Justificante de pago de la tasa'] },
  { codigo: 'PAS-JORN', nombre: 'Pasaporte — Jornada extraordinaria', categoria: 'Pasaportes', duracionEstimada: 25,
    descripcion: 'Trámite presencial durante jornadas especiales convocadas por el Consulado General.',
    requisitos: ['Documentación según jornada anunciada (ver banner web)', 'Cita previa obligatoria'] },

  // Registro Civil
  { codigo: 'REG-MATR', nombre: 'Inscripción de matrimonio', categoria: 'Registro Civil', duracionEstimada: 45,
    descripcion: 'Inscripción de matrimonio en el Registro Civil Consular.',
    requisitos: ['Acta de matrimonio venezolana original y copia', 'Certificado literal de nacimiento del cónyuge español', 'Documento de identidad de ambos cónyuges', 'Fe de soltería previa (si aplica)', 'Cuestionario de inscripción cumplimentado'] },
  { codigo: 'REG-NAC', nombre: 'Inscripción de nacimiento', categoria: 'Registro Civil', duracionEstimada: 40,
    descripcion: 'Inscripción de nacimiento de hijo de español/a.',
    requisitos: ['Acta de nacimiento venezolana original y copia', 'Certificado literal de nacimiento del progenitor español', 'Documentos de identidad de ambos progenitores', 'Acta o certificación de matrimonio (si procede)'] },
  { codigo: 'REG-DEF', nombre: 'Inscripción de defunción', categoria: 'Registro Civil', duracionEstimada: 30,
    descripcion: 'Inscripción de defunción en Registro Civil Consular.',
    requisitos: ['Certificado de defunción venezolano', 'Documento de identidad del fallecido', 'Datos del solicitante y vínculo con el fallecido'] },

  // Certificaciones
  { codigo: 'CERT-FV', nombre: 'Fe de vida', categoria: 'Certificaciones', duracionEstimada: 15,
    descripcion: 'Certificado de fe de vida y estado.',
    requisitos: ['Documento de identidad vigente', 'Comparecencia personal del titular'] },
  { codigo: 'CERT-RES', nombre: 'Certificado de residencia', categoria: 'Certificaciones', duracionEstimada: 15,
    descripcion: 'Certificación de residencia en la circunscripción consular.',
    requisitos: ['Documento de identidad', 'Comprobante de domicilio', 'Comparecencia personal'] },
  { codigo: 'CERT-INSC', nombre: 'Certificado de inscripción consular', categoria: 'Certificaciones', duracionEstimada: 15,
    descripcion: 'Certificación de inscripción en el Registro de Matrícula Consular.',
    requisitos: ['Documento de identidad', 'Estar inscrito en el Registro de Matrícula Consular'] },

  // Identificación / nacionalidad
  { codigo: 'NIE', nombre: 'NIE — Identidad de extranjero', categoria: 'Identificación', duracionEstimada: 25,
    descripcion: 'Solicitud de Número de Identidad de Extranjero.',
    requisitos: ['Pasaporte o documento de identidad vigente', 'Formulario EX-15 cumplimentado', 'Justificante de pago de la tasa', 'Documentación justificativa del motivo de la solicitud'] },
  { codigo: 'NIF', nombre: 'NIF — Identificación fiscal', categoria: 'Identificación', duracionEstimada: 20,
    descripcion: 'Solicitud de Número de Identificación Fiscal para personas sin DNI/NIE.',
    requisitos: ['Pasaporte vigente', 'Formulario 030', 'Documentación justificativa del motivo'] },
  { codigo: 'ALTA-CONS', nombre: 'Alta consular', categoria: 'Identificación', duracionEstimada: 25,
    descripcion: 'Alta en el Registro de Matrícula Consular.',
    requisitos: ['DNI o pasaporte español vigente', 'Comprobante de domicilio en la circunscripción', 'Formulario de inscripción cumplimentado'] },
  { codigo: 'CONS-NAC', nombre: 'Conservación de nacionalidad', categoria: 'Nacionalidad', duracionEstimada: 30,
    descripcion: 'Declaración de conservación de la nacionalidad española.',
    requisitos: ['Documento de identidad español', 'Acta de nacimiento literal', 'Comparecencia personal'] },
  { codigo: 'LMD', nombre: 'Ley de Memoria Democrática (LMD)', categoria: 'Nacionalidad', duracionEstimada: 60,
    descripcion: 'Solicitud al amparo de la Ley 20/2022 de Memoria Democrática.',
    requisitos: ['Documentación probatoria de la condición de origen', 'Documentos de identidad y filiación', 'Formulario específico LMD'] },

  // Otros
  { codigo: 'LEG', nombre: 'Legalizaciones y compulsas', categoria: 'Otros', duracionEstimada: 15,
    descripcion: 'Legalización o compulsa de documentos en competencia del Viceconsulado honorario.',
    requisitos: ['Documento original a legalizar/compulsar', 'Documento de identidad del solicitante'] },
  { codigo: 'OTRO', nombre: 'Otro trámite', categoria: 'Otros', duracionEstimada: 20,
    descripcion: 'Trámite o consulta no clasificado en el catálogo principal.',
    requisitos: ['Indicar el motivo y aportar la documentación pertinente'] },
]

async function main() {
  let creados = 0, actualizados = 0
  for (const t of TRAMITES) {
    const exists = await prisma.tramiteMaestro.findUnique({ where: { codigo: t.codigo } })
    await prisma.tramiteMaestro.upsert({
      where: { codigo: t.codigo },
      update: { nombre: t.nombre, categoria: t.categoria, descripcion: t.descripcion, requisitos: t.requisitos, duracionEstimada: t.duracionEstimada, activo: true },
      create: t,
    })
    if (exists) actualizados++; else creados++
  }
  console.log(`\n✓ Catálogo TramiteMaestro sincronizado`)
  console.log(`  Creados:       ${creados}`)
  console.log(`  Actualizados:  ${actualizados}`)
  console.log(`  Total códigos: ${TRAMITES.length}\n`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
