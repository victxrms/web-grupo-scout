// Pruebas de lectura y validación del Excel y del filtro de dominio.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync, crc32 } from 'node:zlib'
import { validarFilas, compararListado, type EducandoGuardado } from '../../src/lib/asistencia/listado.ts'
import { leerHoja, leerCsv, ErrorHoja } from '../../src/lib/asistencia/excel.ts'
import { esFechaValida } from '../../src/lib/asistencia/normalizar.ts'

// ─── Validación ──────────────────────────────────────────────────────────────

test('Listado válido: cabecera no en la fila 1, apellidos, secciones con distinto formato', () => {
  const r = validarFilas([
    ['Censo 2025/26'],
    [],
    ['NOMBRE', 'Apellidos', 'Sección ', 'Teléfono'],
    ['Ana', 'García', 'Tropa Atenas', '600000000'],
    ['  Luis ', 'Pérez', ' tropa  atenas', ''],
    ['', '', '', ''],
    ['Eva', 'Ruiz', 'TROPA ATÉNAS', ''],
    ['Íñigo', 'Sanz', 'Manada Tha', ''],
  ])
  assert.equal(r.ok, true, JSON.stringify(r.incidencias))
  assert.equal(r.educandos.length, 4)
  assert.equal(new Set(r.educandos.map(e => e.seccionClave)).size, 2)
  assert.ok(r.educandos.every(e => e.seccionClave !== 'tropa-atenas' || e.seccion === 'Tropa Atenas'))
  assert.ok(r.incidencias.some(i => i.nivel === 'aviso' && i.mensaje.includes('unificado')))
  assert.ok(r.incidencias.some(i => i.mensaje.includes('1 fila vacía')))
  // El teléfono NO se extrae: solo nombre, apellidos, sección e ID.
  assert.deepEqual(Object.keys(r.educandos[0]).sort(), ['apellidos', 'id', 'idExcel', 'nombre', 'seccion', 'seccionClave'])
  const luis = r.educandos.find(e => e.nombre === 'Luis')!
  assert.equal(luis.id, 'n-luis-perez')
})

test('Sin cabeceras Nombre/Sección → error claro', () => {
  const r = validarFilas([['Alumno', 'Grupo'], ['Ana', 'Tropa']])
  assert.equal(r.ok, false)
  assert.match(r.incidencias[0].mensaje, /Nombre.*Sección/)
})

test('Archivo vacío → error claro', () => {
  assert.equal(validarFilas([]).ok, false)
  assert.equal(validarFilas([['Nombre', 'Sección']]).ok, false)
})

test('Fila sin sección o sin nombre → error (no se convierte en baja en silencio)', () => {
  const r = validarFilas([['Nombre', 'Sección'], ['Ana', ''], ['', 'Tropa']])
  assert.equal(r.ok, false)
  assert.equal(r.incidencias.filter(i => i.nivel === 'error').length, 2)
  assert.match(r.incidencias[0].mensaje, /Fila 2/)
})

test('Duplicados por nombre (sin ID) y por ID', () => {
  const r1 = validarFilas([['Nombre', 'Sección'], ['Ana García', 'Tropa'], ['ana garcía', 'Manada']])
  assert.equal(r1.ok, false)
  assert.match(r1.incidencias.find(i => i.nivel === 'error')!.mensaje, /repetid/)

  const r2 = validarFilas([['ID', 'Nombre', 'Sección'], ['7', 'Ana', 'Tropa'], ['7', 'Luis', 'Tropa']])
  assert.equal(r2.ok, false)
  assert.match(r2.incidencias.find(i => i.nivel === 'error')!.mensaje, /ID repetido/)

  // Con ID distinto, dos personas con el mismo nombre son válidas.
  const r3 = validarFilas([['ID', 'Nombre', 'Sección'], ['7', 'Ana', 'Tropa'], ['8', 'Ana', 'Tropa']])
  assert.equal(r3.ok, true)
  assert.deepEqual(r3.educandos.map(e => e.id).sort(), ['x-7', 'x-8'])
})

test('Con columna ID, una fila sin ID es un error', () => {
  const r = validarFilas([['ID', 'Nombre', 'Sección'], ['1', 'Ana', 'Tropa'], ['', 'Luis', 'Tropa']])
  assert.equal(r.ok, false)
})

test('Comparar listado: altas, bajas, cambios de sección y reactivaciones', () => {
  const g = (id: string, nombre: string, seccionClave: string, activo = true): EducandoGuardado =>
    ({ id, nombre, apellidos: '', seccion: seccionClave, seccionClave, idExcel: '', activo })
  const actuales = [g('n-ana', 'Ana', 'manada'), g('n-luis', 'Luis', 'tropa'), g('n-eva', 'Eva', 'tropa', false), g('n-leo', 'Leo', 'tropa')]
  const nuevo = validarFilas([['Nombre', 'Sección'], ['Ana', 'tropa'], ['Eva', 'tropa'], ['Leo', 'tropa'], ['Noa', 'manada']]).educandos
  const c = compararListado(nuevo, actuales)
  assert.deepEqual(c.altas.map(e => e.nombre), ['Noa'])
  assert.deepEqual(c.bajas.map(e => e.nombre), ['Luis'])
  assert.deepEqual(c.cambiosSeccion.map(x => x.despues.id), ['n-ana']) // mismo ID → conserva histórico
  assert.deepEqual(c.reactivados.map(e => e.nombre), ['Eva'])
  assert.equal(c.sinCambios, 1)
})

// ─── Lectura de archivos ─────────────────────────────────────────────────────

/** Crea un .xlsx mínimo (ZIP con XML) en memoria, como lo guardaría Excel. */
function crearXlsx(archivos: Record<string, string>): ArrayBuffer {
  const locales: Buffer[] = []
  const centrales: Buffer[] = []
  let offset = 0
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const datos = Buffer.from(contenido, 'utf-8')
    const comp = deflateRawSync(datos)
    const n = Buffer.from(nombre)
    const crc = crc32(datos)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(datos.length, 22)
    local.writeUInt16LE(n.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(datos.length, 24)
    central.writeUInt16LE(n.length, 28); central.writeUInt32LE(offset, 42)
    locales.push(local, n, comp)
    centrales.push(central, n)
    offset += 30 + n.length + comp.length
  }
  const cd = Buffer.concat(centrales)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(Object.keys(archivos).length, 8); fin.writeUInt16LE(Object.keys(archivos).length, 10)
  fin.writeUInt32LE(cd.length, 12); fin.writeUInt32LE(offset, 16)
  const b = Buffer.concat([...locales, cd, fin])
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}

test('Lee un .xlsx: textos compartidos, en línea, texto enriquecido, números y huecos', async () => {
  const xlsx = crearXlsx({
    'xl/workbook.xml': '<workbook><sheets><sheet name="Censo" sheetId="1" r:id="rId1"/><sheet name="Otra" sheetId="2" r:id="rId2"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>Nombre</t></si><si><t>Sección</t></si><si><r><t>Jos</t></r><r><rPr><b/></rPr><t>é &amp; Ñu</t></r></si><si><t xml:space="preserve"> Tropa </t></si></sst>',
    'xl/worksheets/sheet1.xml': '<worksheet><sheetData>'
      + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>ID</t></is></c></row>'
      + '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c><c r="D3"><v>42</v></c></row>'
      + '</sheetData></worksheet>',
    'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>NO</t></is></c></row></sheetData></worksheet>',
  })
  const filas = await leerHoja(xlsx)
  assert.deepEqual(filas, [['Nombre', '', 'Sección', 'ID'], [], ['José & Ñu', '', ' Tropa ', '42']])
  const r = validarFilas(filas)
  assert.equal(r.ok, true)
  assert.deepEqual(r.educandos.map(e => [e.id, e.nombre, e.seccion]), [['x-42', 'José & Ñu', 'Tropa']])
})

test('Lee CSV con «;», comillas y BOM', () => {
  const filas = leerCsv('﻿Nombre;Sección\r\n"García; Ana";Tropa\r\n"Luis ""el rápido""";Manada\r\n')
  assert.deepEqual(filas, [['Nombre', 'Sección'], ['García; Ana', 'Tropa'], ['Luis "el rápido"', 'Manada']])
})

test('Archivos no válidos dan un error claro, nunca una excepción rara', async () => {
  const xls = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]).buffer
  await assert.rejects(leerHoja(xls), (e: unknown) => e instanceof ErrorHoja && /xlsx/.test((e as Error).message))
  await assert.rejects(leerHoja(new ArrayBuffer(0)), ErrorHoja)
  await assert.rejects(leerHoja(new Uint8Array([0x50, 0x4b, 3, 4, 9, 9]).buffer), ErrorHoja)
})

test('Fechas válidas', () => {
  assert.equal(esFechaValida('2025-10-04'), true)
  assert.equal(esFechaValida('2025-02-31'), false)
  assert.equal(esFechaValida('04/10/2025'), false)
})
