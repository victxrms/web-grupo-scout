// Pruebas del contenido editable, los permisos y la validación. Ejecutar con:  npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONTENIDO_INICIAL, avisoVigente, colorValido, completar, enlaceWhatsapp, leerJson, urlSegura, vacio,
} from '../src/lib/contenido.ts'
import { normalizarDominio, rolDeCuenta } from '../src/lib/roles.ts'
import { problemas } from '../src/lib/validar.ts'
import { idPatrulla } from '../src/lib/puntos-id.ts'

const copia = () => structuredClone(CONTENIDO_INICIAL)

test('Contenido guardado incompleto o antiguo: se completa sin romperse', () => {
  const c = completar({ grupo: { nombre: 'GS Pruebas', email: 42 }, secciones: [{ nombre: 'Manada' }], galeria: ['/fotos/a.jpg', 3] }, CONTENIDO_INICIAL)
  assert.equal(c.grupo.nombre, 'GS Pruebas')
  assert.equal(c.grupo.email, CONTENIDO_INICIAL.grupo.email) // tipo incorrecto → el de partida
  assert.equal(c.grupo.ciudad, CONTENIDO_INICIAL.grupo.ciudad)
  assert.deepEqual(c.secciones, [{ id: '', nombre: 'Manada', rama: '', edades: '', emoji: '', texto: '' }])
  assert.deepEqual(c.galeria, ['/fotos/a.jpg', ''])
  assert.deepEqual(c.paginas, CONTENIDO_INICIAL.paginas)
  assert.equal(leerJson('no es json'), null)
  assert.equal(leerJson(''), null)
  assert.deepEqual(leerJson(JSON.stringify(CONTENIDO_INICIAL)), CONTENIDO_INICIAL)
  assert.deepEqual(vacio({ a: 'x', b: [1], c: true, d: 3 }), { a: '', b: [], c: false, d: 0 })
})

test('Solo enlaces seguros', () => {
  assert.equal(urlSegura('https://ejemplo.org'), 'https://ejemplo.org')
  assert.equal(urlSegura('/fotos/a.jpg'), '/fotos/a.jpg')
  assert.equal(urlSegura('mailto:a@b.org'), 'mailto:a@b.org')
  for (const malo of ['javascript:alert(1)', '//otro.org/x', 'data:text/html,hola', '', '   ']) assert.equal(urlSegura(malo), null, malo)
  assert.equal(colorValido('#123abc'), '#123abc')
  assert.equal(colorValido('red'), CONTENIDO_INICIAL.apariencia.colorPrincipal)
})

test('WhatsApp y aviso', () => {
  const c = copia()
  assert.equal(enlaceWhatsapp(c, 'hola'), null)
  c.grupo.whatsapp = '34 600 111 222'
  assert.equal(enlaceWhatsapp(c, 'hola qué tal'), 'https://wa.me/34600111222?text=hola%20qu%C3%A9%20tal')
  c.aviso = { ...c.aviso, activo: true, texto: 'Fiesta', hasta: '2026-04-11' }
  assert.equal(avisoVigente(c, new Date('2026-04-11T20:00:00')), true)
  assert.equal(avisoVigente(c, new Date('2026-04-12T00:00:01')), false)
  c.aviso.hasta = ''
  assert.equal(avisoVigente(c), true)
  c.aviso.activo = false
  assert.equal(avisoVigente(c), false)
})

test('Permisos del Kraal', () => {
  const g = (email: string, extra: Partial<{ verificado: boolean; google: boolean }> = {}) => ({ email, verificado: true, google: true, ...extra })
  const base = { adminInicial: 'Jefa@Gmail.com', miembro: null, dominio: '' }
  assert.equal(rolDeCuenta(g('jefa@gmail.com'), base), 'admin')
  assert.equal(rolDeCuenta(g('otra@gmail.com'), base), null)
  assert.equal(rolDeCuenta(g('otra@gmail.com'), { ...base, miembro: { rol: 'scouter' } }), 'scouter')
  assert.equal(rolDeCuenta(g('otra@gmail.com'), { ...base, miembro: { rol: 'admin' } }), 'admin')
  assert.equal(rolDeCuenta(g('otra@gmail.com'), { ...base, miembro: { rol: 'raro' } }), 'scouter')
  assert.equal(rolDeCuenta(g('ana@migrupo.org'), { ...base, dominio: 'migrupo.org' }), 'scouter')
  assert.equal(rolDeCuenta(g('ana@migrupo.org.evil.com'), { ...base, dominio: 'migrupo.org' }), null)
  assert.equal(rolDeCuenta(g('jefa@gmail.com', { verificado: false }), base), null)
  assert.equal(rolDeCuenta(g('jefa@gmail.com', { google: false }), base), null)
  assert.equal(normalizarDominio('@MiGrupo.org '), 'migrupo.org')
  assert.equal(normalizarDominio('no es dominio'), '')
})

test('Validación antes de publicar', () => {
  assert.deepEqual(problemas(CONTENIDO_INICIAL), [])
  const c = copia()
  c.grupo.nombre = ' '
  c.grupo.whatsapp = '+34 600'
  c.apariencia.colorPrincipal = 'verde'
  c.secciones[1].id = 'manada'
  c.secciones[2].id = 'Con Espacios'
  c.documentos = [{ titulo: 'Malo', descripcion: '', url: 'javascript:alert(1)', nota: '' }]
  const p = problemas(c).join('\n')
  for (const esperado of ['nombre del grupo', 'WhatsApp', 'color', '«manada» está repetido', 'minúsculas', 'Documentos: «Malo»']) {
    assert.match(p, new RegExp(esperado), esperado)
  }
})

test('Identificador de patrulla', () => {
  assert.equal(idPatrulla('Águila Real'), 'aguila-real')
  assert.equal(idPatrulla('  ¡Oso!  '), 'oso')
  assert.equal(idPatrulla('🦅'), '')
})
