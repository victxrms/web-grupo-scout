// Pruebas del enlace de Google Drive y de los nombres con iniciales.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { idDeEnlaceDrive } from '../../src/lib/asistencia/enlaceDrive.ts'
import { claveNombre, idEducando } from '../../src/lib/asistencia/normalizar.ts'
import { validarFilas, compararListado } from '../../src/lib/asistencia/listado.ts'

const ID = '1AbC_dEf-123456789ghijKLmnOPqrs'

test('Saca el ID de los enlaces habituales de Drive y Hojas de cálculo', () => {
  for (const enlace of [
    `https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing#gid=0`,
    `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
    `https://drive.google.com/open?id=${ID}`,
    `https://drive.google.com/uc?id=${ID}&export=download`,
    `https://docs.google.com/spreadsheets/u/1/d/${ID}/edit`,
    `  ${ID}  `,
  ]) assert.equal(idDeEnlaceDrive(enlace), ID, enlace)
})

test('Rechaza enlaces que no son de Drive', () => {
  for (const malo of [
    `https://evil.com/file/d/${ID}/view`,
    `http://drive.google.com/file/d/${ID}/view`,
    `https://drive.google.com.evil.com/file/d/${ID}`,
    'https://drive.google.com/drive/my-drive',
    'hola', '', 'javascript:alert(1)',
  ]) assert.equal(idDeEnlaceDrive(malo), null, malo)
})

test('Distintas formas de escribir las iniciales dan el mismo ID', () => {
  const formas = ['Ana G.P.', 'Ana G. P.', 'ana gp', 'ANA G-P', 'Ana  G.P', 'Ána G.P.']
  for (const f of formas) assert.equal(claveNombre(f), 'ana-gp', f)
  assert.equal(idEducando('', 'Ana', 'G.P.'), idEducando('', 'Ana G. P.', ''))
  assert.equal(claveNombre('María José R.'), 'maria-jose-r')
  assert.equal(claveNombre('Luis Pérez'), 'luis-perez')
  // Iniciales distintas → personas distintas
  assert.notEqual(claveNombre('Ana G.P.'), claveNombre('Ana G.M.'))
})

test('Excel con «Nombre» + «Iniciales»', () => {
  const r = validarFilas([['Nombre', 'Iniciales', 'Sección'], ['Ana', 'G.P.', 'Tropa'], ['Ana', 'G.M.', 'Tropa']])
  assert.equal(r.ok, true, JSON.stringify(r.incidencias))
  assert.deepEqual(r.educandos.map(e => e.id).sort(), ['n-ana-gm', 'n-ana-gp'])
  assert.deepEqual(r.columnas.apellidos, ['Iniciales'])
})

test('Excel con nombre e iniciales en una sola columna', () => {
  const r = validarFilas([['Educando', 'Sección'], ['Lucía M.R.', 'Manada'], ['Pablo S. T.', 'Manada']])
  assert.equal(r.ok, true)
  assert.deepEqual(r.educandos.map(e => e.id).sort(), ['n-lucia-mr', 'n-pablo-st'])
})

test('Dos educandos con mismo nombre e iniciales → error con solución propuesta', () => {
  const r = validarFilas([['Nombre', 'Sección'], ['Lucía M.R.', 'Tropa'], ['Lucía M. R.', 'Tropa']])
  assert.equal(r.ok, false)
  const msg = r.incidencias.find(i => i.nivel === 'error')!.mensaje
  assert.match(msg, /filas 2, 3/)
  assert.match(msg, /\(2\)/)
  // La solución propuesta funciona:
  assert.equal(validarFilas([['Nombre', 'Sección'], ['Lucía M.R.', 'Tropa'], ['Lucía M.R. (2)', 'Tropa']]).ok, true)
})

test('Corregir solo el formato de las iniciales no crea una persona nueva', () => {
  const antes = validarFilas([['Nombre', 'Sección'], ['Ana G.P.', 'Tropa']]).educandos.map(e => ({ ...e, activo: true }))
  const despues = validarFilas([['Nombre', 'Sección'], ['Ana G. P.', 'Tropa']]).educandos
  const c = compararListado(despues, antes)
  assert.equal(c.altas.length, 0)
  assert.equal(c.bajas.length, 0)
  assert.equal(c.otrosCambios.length, 1) // solo se actualiza cómo se muestra
})
