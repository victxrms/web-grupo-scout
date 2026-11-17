// Páginas públicas: ruta, nombre en el menú, título y descripción para
// buscadores. Lo usan el menú, el pie, las rutas y el prerenderizado
// (scripts/prerender.mjs), así que todo sale de aquí y del contenido.

import type { Contenido } from './contenido.ts'

export interface Pagina {
  ruta: string
  menu: string
  titulo: (c: Contenido) => string
  descripcion: (c: Contenido) => string
  /** ¿Está activada? (se activan y desactivan en Editar la web → Páginas). */
  visible: (c: Contenido) => boolean
  /** No aparece en el menú de arriba (sí en el pie). */
  soloPie?: boolean
}

const lugar = (c: Contenido) => [c.grupo.ciudad, c.grupo.provincia].filter(Boolean).join(', ')

export const PAGINAS: Pagina[] = [
  {
    ruta: '/',
    menu: 'Inicio',
    titulo: c => `${c.grupo.nombre} · Scouts en ${c.grupo.ciudad}`,
    descripcion: c => `${c.grupo.nombre}: grupo scout en ${lugar(c)}. Educación en valores, naturaleza y aventura para niñas, niños y jóvenes.`,
    visible: () => true,
    soloPie: true,
  },
  {
    ruta: '/secciones',
    menu: 'Secciones',
    titulo: c => `Secciones · ${c.grupo.nombre}`,
    descripcion: c => `Las secciones del ${c.grupo.nombre} por edades: ${c.secciones.map(s => s.nombre).join(', ')}.`,
    visible: c => c.secciones.length > 0,
  },
  {
    ruta: '/galeria',
    menu: 'Galería',
    titulo: c => `Galería · ${c.grupo.nombre}`,
    descripcion: c => `Fotos de actividades y acampadas del ${c.grupo.nombre}.`,
    visible: c => c.paginas.galeria,
  },
  {
    ruta: '/documentos',
    menu: 'Documentos',
    titulo: c => `Documentos · ${c.grupo.nombre}`,
    descripcion: c => `Documentación para las familias del ${c.grupo.nombre}.`,
    visible: c => c.paginas.documentos,
  },
  {
    ruta: '/patrullometro',
    menu: 'Patrullómetro',
    titulo: c => `Patrullómetro · ${c.grupo.nombre}`,
    descripcion: c => `Clasificación de las patrullas del ${c.grupo.nombre} en tiempo real.`,
    visible: c => c.paginas.patrullometro,
  },
  {
    ruta: '/lugares',
    menu: 'Acampadas',
    titulo: c => `Lugares de acampada · ${c.grupo.nombre}`,
    descripcion: c => `Mapa de lugares para acampadas y campamentos que conoce el ${c.grupo.nombre}.`,
    visible: c => c.paginas.lugares,
  },
  {
    ruta: '/herramientas',
    menu: 'Herramientas',
    titulo: c => `Herramientas · ${c.grupo.nombre}`,
    descripcion: c => `Guías prácticas del ${c.grupo.nombre} para preparar cada salida.`,
    visible: c => c.paginas.herramientas,
    soloPie: true,
  },
  {
    ruta: '/equipo',
    menu: 'Kraal',
    titulo: c => `Kraal · ${c.grupo.nombre}`,
    descripcion: c => `El equipo de scouters voluntarias del ${c.grupo.nombre}.`,
    visible: c => c.paginas.equipo,
    soloPie: true,
  },
  {
    ruta: '/unete',
    menu: 'Únete',
    titulo: c => `Únete · Cómo apuntarse al ${c.grupo.nombre}`,
    descripcion: c => `Cómo apuntarse a los scouts en ${c.grupo.ciudad}: pasos, edades por sección, dónde estamos y contacto.`,
    visible: () => true,
  },
]

/** Páginas que no se indexan (Kraal y 404): título propio, fuera del sitemap. */
export const PAGINAS_PRIVADAS: { ruta: string; titulo: (c: Contenido) => string }[] = [
  { ruta: '/kraal', titulo: c => `Kraal · ${c.grupo.nombre}` },
  { ruta: '/404', titulo: c => `Página no encontrada · ${c.grupo.nombre}` },
]
