// Validación del listado de educandos que viene del Excel y comparación con
// lo que ya hay guardado. Lógica pura (sin Firebase) para poder probarla.
//
// El Excel es la ÚNICA fuente de verdad de quién existe y en qué sección está.
// De él solo se extraen: nombre, apellidos (si hay), sección e ID (si hay).
// Cualquier otra columna (teléfonos, DNI, alergias…) se ignora y NUNCA se guarda.

import {
  claveTexto, compararEs, idEducando, limpiarTexto, slug,
  PATRON_CLAVE_SECCION, PATRON_ID_EDUCANDO,
} from './normalizar.ts'

export interface EducandoListado {
  id: string
  nombre: string
  apellidos: string
  seccion: string
  seccionClave: string
  idExcel: string
}

export interface Incidencia {
  nivel: 'error' | 'aviso'
  mensaje: string
}

export interface ResultadoListado {
  /** true si no hay errores y se puede aplicar. */
  ok: boolean
  educandos: EducandoListado[]
  incidencias: Incidencia[]
  /** Columnas detectadas (para mostrarlas al admin). */
  columnas: { nombre: string; seccion: string; apellidos: string[]; id: string | null }
}

const MAX_FILAS = 3000
const MAX_NOMBRE = 80
const MAX_APELLIDOS = 120
const MAX_SECCION = 60

// Cabeceras aceptadas (se comparan sin tildes ni mayúsculas).
const ALIAS_NOMBRE = ['nombre', 'nombres', 'educando', 'nombre educando', 'nombre del educando', 'nombre y apellidos', 'nombre e iniciales', 'nombre y iniciales', 'nombre completo']
const ALIAS_SECCION = ['seccion', 'secciones', 'rama', 'seccion actual']
const ALIAS_ID = ['id', 'codigo', 'cod', 'id educando', 'codigo educando', 'n socio', 'no socio', 'num socio', 'numero socio', 'numero de socio', 'socio']

/** Clave de una cabecera: sin tildes y con cualquier signo convertido en espacio. */
const claveCabecera = (s: string) => slug(s).replace(/-/g, ' ')

function buscarCabecera(filas: string[][]) {
  // La cabecera puede no estar en la fila 1 (títulos, logos…): se busca en las 10 primeras.
  for (let f = 0; f < Math.min(filas.length, 10); f++) {
    const claves = filas[f].map(c => claveCabecera(c ?? ''))
    const nombre = claves.findIndex(c => ALIAS_NOMBRE.includes(c))
    const seccion = claves.findIndex(c => ALIAS_SECCION.includes(c))
    if (nombre === -1 || seccion === -1) continue
    // "Apellidos", "Apellido 1", "Iniciales", "Iniciales apellidos"…
    const apellidos = claves
      .map((c, i) => (i !== nombre && (c.startsWith('apellido') || c.startsWith('inicial')) ? i : -1))
      .filter(i => i !== -1)
    const id = claves.findIndex(c => ALIAS_ID.includes(c))
    return { fila: f, nombre, seccion, apellidos, id: id === -1 ? null : id }
  }
  return null
}

export function validarFilas(filas: string[][]): ResultadoListado {
  const incidencias: Incidencia[] = []
  const error = (mensaje: string) => incidencias.push({ nivel: 'error', mensaje })
  const aviso = (mensaje: string) => incidencias.push({ nivel: 'aviso', mensaje })
  const vacio: ResultadoListado = {
    ok: false, educandos: [], incidencias,
    columnas: { nombre: '', seccion: '', apellidos: [], id: null },
  }

  if (filas.length === 0) {
    error('El archivo está vacío o no tiene ninguna hoja con datos.')
    return vacio
  }
  if (filas.length > MAX_FILAS) {
    error(`El archivo tiene ${filas.length} filas; el máximo es ${MAX_FILAS}. ¿Es el archivo correcto?`)
    return vacio
  }

  const cab = buscarCabecera(filas)
  if (!cab) {
    error('No encuentro las columnas «Nombre» y «Sección». Comprueba que la primera hoja tenga una fila de cabecera con esos títulos.')
    return vacio
  }
  const cabecera = filas[cab.fila]
  const columnas = {
    nombre: limpiarTexto(cabecera[cab.nombre]),
    seccion: limpiarTexto(cabecera[cab.seccion]),
    apellidos: cab.apellidos.map(i => limpiarTexto(cabecera[i])),
    id: cab.id === null ? null : limpiarTexto(cabecera[cab.id]),
  }

  const educandos: EducandoListado[] = []
  const filaDe = new Map<EducandoListado, number>()
  // Para unificar secciones escritas de distinta forma: clave → {variante → nº de veces}
  const variantes = new Map<string, Map<string, number>>()
  let filasVacias = 0

  for (let f = cab.fila + 1; f < filas.length; f++) {
    const fila = filas[f] ?? []
    const numFila = f + 1 // nº de fila tal como se ve en Excel
    const nombre = limpiarTexto(fila[cab.nombre])
    const seccion = limpiarTexto(fila[cab.seccion])
    const apellidos = cab.apellidos.map(i => limpiarTexto(fila[i])).filter(Boolean).join(' ')
    const idExcel = cab.id === null ? '' : limpiarTexto(fila[cab.id])

    if (!nombre && !seccion && !apellidos && !idExcel) { filasVacias++; continue }

    // Una fila a medias es un error y no un aviso: si se ignorara, ese
    // educando aparecería como "baja" y se ocultaría su deuda.
    if (!nombre) { error(`Fila ${numFila}: falta el nombre.`); continue }
    if (!seccion) { error(`Fila ${numFila} (${nombre}): falta la sección.`); continue }
    if (nombre.length > MAX_NOMBRE) { error(`Fila ${numFila}: el nombre es demasiado largo (máx. ${MAX_NOMBRE} caracteres).`); continue }
    if (apellidos.length > MAX_APELLIDOS) { error(`Fila ${numFila}: los apellidos son demasiado largos.`); continue }
    if (seccion.length > MAX_SECCION) { error(`Fila ${numFila}: el nombre de la sección es demasiado largo.`); continue }
    if (cab.id !== null && !idExcel) {
      error(`Fila ${numFila} (${nombre}): la columna «${columnas.id}» está vacía. Si el Excel tiene columna de ID, todas las filas deben tenerlo.`)
      continue
    }

    const seccionClave = slug(seccion, 60)
    const id = idEducando(idExcel, nombre, apellidos)
    if (!PATRON_CLAVE_SECCION.test(seccionClave)) { error(`Fila ${numFila}: la sección «${seccion}» no tiene letras ni números.`); continue }
    if (!PATRON_ID_EDUCANDO.test(id) || id.length < 3) { error(`Fila ${numFila}: no se puede generar un identificador para «${nombre}».`); continue }

    const vs = variantes.get(seccionClave) ?? new Map<string, number>()
    vs.set(seccion, (vs.get(seccion) ?? 0) + 1)
    variantes.set(seccionClave, vs)

    const e: EducandoListado = { id, nombre, apellidos, seccion, seccionClave, idExcel }
    educandos.push(e)
    filaDe.set(e, numFila)
  }

  // Secciones: se usa la forma más repetida y se avisa de las unificadas.
  const nombreSeccion = new Map<string, string>()
  for (const [clave, vs] of variantes) {
    const ordenadas = [...vs.entries()].sort((a, b) => b[1] - a[1])
    nombreSeccion.set(clave, ordenadas[0][0])
    if (ordenadas.length > 1) {
      aviso(`Se han unificado como «${ordenadas[0][0]}» estas formas de escribir la sección: ${ordenadas.map(([v]) => `«${v}»`).join(', ')}.`)
    }
  }
  for (const e of educandos) e.seccion = nombreSeccion.get(e.seccionClave)!

  // Duplicados (mismo ID, o mismo nombre completo si no hay columna de ID).
  const porId = new Map<string, EducandoListado[]>()
  for (const e of educandos) porId.set(e.id, [...(porId.get(e.id) ?? []), e])
  for (const grupo of porId.values()) {
    if (grupo.length < 2) continue
    const filasTxt = grupo.map(e => filaDe.get(e)).join(', ')
    if (cab.id !== null) {
      error(`ID repetido «${grupo[0].idExcel}» en las filas ${filasTxt}. Cada educando debe tener un ID distinto.`)
    } else {
      const quien = `${grupo[0].nombre} ${grupo[0].apellidos}`.trim()
      error(`«${quien}» aparece repetido (filas ${filasTxt}). Si es un error, borra la fila sobrante. Si son personas distintas con el mismo nombre e iniciales, distínguelas en el Excel (por ejemplo «${quien} (2)») o añade una columna «ID».`)
    }
  }

  if (filasVacias > 0) aviso(filasVacias === 1 ? 'Se ha ignorado 1 fila vacía.' : `Se han ignorado ${filasVacias} filas vacías.`)
  if (educandos.length === 0 && !incidencias.some(i => i.nivel === 'error')) {
    error('No hay ningún educando en el archivo.')
  }

  educandos.sort((a, b) => compararEs(a.seccion, b.seccion) || compararEs(a.nombre, b.nombre) || compararEs(a.apellidos, b.apellidos))
  return { ok: !incidencias.some(i => i.nivel === 'error'), educandos, incidencias, columnas }
}

/** Educando tal como está guardado en la base de datos. */
export interface EducandoGuardado extends EducandoListado {
  activo: boolean
}

export interface CambiosListado {
  altas: EducandoListado[]
  /** Estaban de baja y vuelven a aparecer en el Excel. */
  reactivados: EducandoListado[]
  /** Ya no están en el Excel: se marcan como baja, NO se borran (se conserva su histórico y su deuda). */
  bajas: EducandoGuardado[]
  cambiosSeccion: { antes: EducandoGuardado; despues: EducandoListado }[]
  /** Cambios de nombre, apellidos o forma de escribir la sección. */
  otrosCambios: EducandoListado[]
  sinCambios: number
}

export function compararListado(nuevo: EducandoListado[], actuales: EducandoGuardado[]): CambiosListado {
  const cambios: CambiosListado = { altas: [], reactivados: [], bajas: [], cambiosSeccion: [], otrosCambios: [], sinCambios: 0 }
  const porId = new Map(actuales.map(e => [e.id, e]))
  const enExcel = new Set<string>()

  for (const e of nuevo) {
    enExcel.add(e.id)
    const antes = porId.get(e.id)
    if (!antes) { cambios.altas.push(e); continue }
    if (!antes.activo) { cambios.reactivados.push(e); continue }
    if (antes.seccionClave !== e.seccionClave) { cambios.cambiosSeccion.push({ antes, despues: e }); continue }
    if (antes.nombre !== e.nombre || antes.apellidos !== e.apellidos || antes.seccion !== e.seccion || antes.idExcel !== e.idExcel) {
      cambios.otrosCambios.push(e)
      continue
    }
    cambios.sinCambios++
  }
  for (const a of actuales) if (a.activo && !enExcel.has(a.id)) cambios.bajas.push(a)
  return cambios
}

/** Nombre para mostrar: "Nombre Apellidos". */
export const nombreCompleto = (e: { nombre: string; apellidos: string }) =>
  e.apellidos ? `${e.nombre} ${e.apellidos}` : e.nombre

/** Clave para buscar por nombre sin tildes ni mayúsculas. */
export const claveBusqueda = (e: { nombre: string; apellidos: string }) => claveTexto(nombreCompleto(e))
