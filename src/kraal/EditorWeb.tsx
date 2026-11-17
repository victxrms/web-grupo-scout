// Editor de la web (solo administradoras): Kraal → Editar la web.
//
// Todo el contenido se guarda junto en web/contenido. Al pulsar «Publicar»
// la web pública lo muestra al momento (no hace falta volver a desplegar).
import { useEffect, useId, useState, type ReactNode } from 'react'
import { useContenido, vacio, type Contenido } from '../lib/contenido.ts'
import { useActualizarContenido } from '../lib/contenido-editor.ts'
import { ConflictoContenido, leerParaEditar, problemas, publicar } from '../lib/editor.ts'
import { auth } from '../lib/auth.ts'

type Apartado = 'general' | 'apariencia' | 'inicio' | 'secciones' | 'unete' | 'documentos' | 'galeria'
  | 'herramientas' | 'equipo' | 'lugares' | 'aviso' | 'paginas'

const APARTADOS: { id: Apartado; titulo: string }[] = [
  { id: 'general', titulo: 'General' },
  { id: 'apariencia', titulo: 'Apariencia' },
  { id: 'inicio', titulo: 'Inicio' },
  { id: 'secciones', titulo: 'Secciones' },
  { id: 'unete', titulo: 'Únete' },
  { id: 'documentos', titulo: 'Documentos' },
  { id: 'galeria', titulo: 'Galería' },
  { id: 'herramientas', titulo: 'Herramientas' },
  { id: 'equipo', titulo: 'Kraal' },
  { id: 'lugares', titulo: 'Acampadas' },
  { id: 'aviso', titulo: 'Aviso' },
  { id: 'paginas', titulo: 'Páginas' },
]

export default function EditorWeb() {
  const publicado = useContenido()
  const actualizarWeb = useActualizarContenido()
  const [b, setB] = useState<Contenido | null>(null)
  const [original, setOriginal] = useState('')
  const [version, setVersion] = useState(0)
  const [apartado, setApartado] = useState<Apartado>('general')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error' | 'info'; texto: ReactNode } | null>(null)
  const [conflicto, setConflicto] = useState<string | null>(null)

  const cargar = async () => {
    setMensaje(null); setConflicto(null)
    try {
      const r = await leerParaEditar()
      setB(r.contenido); setOriginal(JSON.stringify(r.contenido)); setVersion(r.version)
    } catch (e) {
      console.error(e)
      setMensaje({ tipo: 'error', texto: 'No se ha podido cargar el contenido. Comprueba la conexión.' })
      setB(publicado); setOriginal(JSON.stringify(publicado))
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [])

  const pendiente = b !== null && JSON.stringify(b) !== original
  useEffect(() => {
    if (!pendiente) return
    const antes = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', antes)
    return () => window.removeEventListener('beforeunload', antes)
  }, [pendiente])

  if (!b) return <p className="suave" role="status">Cargando…</p>

  const fallos = problemas(b)
  const guardar = async (sobrescribir = false) => {
    if (fallos.length) return setMensaje({ tipo: 'error', texto: <>Corrige antes de publicar:<ul>{fallos.map(f => <li key={f}>{f}</li>)}</ul></> })
    setGuardando(true); setMensaje(null)
    try {
      const v = await publicar(b, version, auth.currentUser?.email ?? '', sobrescribir)
      setVersion(v); setOriginal(JSON.stringify(b)); setConflicto(null)
      actualizarWeb(b)
      setMensaje({ tipo: 'ok', texto: <>Publicado ✓ <a href="/" target="_blank" rel="noopener">Ver la web</a></> })
    } catch (e) {
      if (e instanceof ConflictoContenido) {
        setConflicto(e.correo || 'otra administradora')
      } else {
        console.error(e)
        setMensaje({ tipo: 'error', texto: 'No se ha podido publicar. Comprueba la conexión y que eres administradora.' })
      }
    } finally {
      setGuardando(false)
    }
  }

  const descargarCopia = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'contenido-web.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Cambios por apartado
  const g = (x: Partial<Contenido['grupo']>) => setB({ ...b, grupo: { ...b.grupo, ...x } })
  const ap = (x: Partial<Contenido['apariencia']>) => setB({ ...b, apariencia: { ...b.apariencia, ...x } })

  return (
    <>
      <h1>Editar la web</h1>
      <p className="suave">
        Los cambios no se ven hasta que pulsas <strong>Publicar</strong>. En los textos largos: una línea en blanco separa
        párrafos, <code>**así**</code> se pone en negrita y <code>[texto](https://...)</code> crea un enlace.
      </p>

      <div className="pestanas" role="tablist" aria-label="Apartados">
        {APARTADOS.map(a => (
          <button key={a.id} type="button" role="tab" aria-selected={apartado === a.id} onClick={() => setApartado(a.id)}>{a.titulo}</button>
        ))}
      </div>

      <div className="formulario" role="tabpanel" aria-label={APARTADOS.find(a => a.id === apartado)?.titulo}>
        {apartado === 'general' && (
          <>
            <div className="dos-columnas">
              <Campo etiqueta="Nombre del grupo" valor={b.grupo.nombre} alCambiar={v => g({ nombre: v })} />
              <Campo etiqueta="Nombre corto (cabecera)" valor={b.grupo.nombreCorto} alCambiar={v => g({ nombreCorto: v })} />
              <Campo etiqueta="Lema" valor={b.grupo.lema} alCambiar={v => g({ lema: v })} />
              <Campo etiqueta="Ciudad" valor={b.grupo.ciudad} alCambiar={v => g({ ciudad: v })} />
              <Campo etiqueta="Provincia" valor={b.grupo.provincia} alCambiar={v => g({ provincia: v })} />
              <Campo etiqueta="Correo de contacto" tipo="email" valor={b.grupo.email} alCambiar={v => g({ email: v })} />
              <Campo etiqueta="WhatsApp (con prefijo, sin espacios)" valor={b.grupo.whatsapp} alCambiar={v => g({ whatsapp: v })} ayuda="Ejemplo: 34600111222. Vacío si no tenéis." />
              <Campo etiqueta="Teléfono tal como se enseña" valor={b.grupo.telefono} alCambiar={v => g({ telefono: v })} ayuda="Ejemplo: 600 111 222" />
            </div>
            <Casilla etiqueta="El teléfono solo atiende WhatsApp (no llamadas)" valor={b.grupo.soloWhatsapp} alCambiar={v => g({ soloWhatsapp: v })} />
            <h2>Dónde estáis</h2>
            <div className="dos-columnas">
              <Campo etiqueta="Sede (colegio, local…)" valor={b.grupo.sede} alCambiar={v => g({ sede: v })} />
              <Campo etiqueta="Dirección" valor={b.grupo.direccion} alCambiar={v => g({ direccion: v })} />
              <Campo etiqueta="Código postal" valor={b.grupo.codigoPostal} alCambiar={v => g({ codigoPostal: v })} />
              <Campo etiqueta="Enlace de Google Maps" tipo="url" valor={b.grupo.mapsUrl} alCambiar={v => g({ mapsUrl: v })} />
            </div>
            <Campo etiqueta="Enlace a la ficha de inscripción (opcional)" tipo="url" valor={b.grupo.fichaInscripcionUrl} alCambiar={v => g({ fichaInscripcionUrl: v })} />
            <h2>Redes sociales</h2>
            <div className="dos-columnas">
              {(['instagram', 'youtube', 'facebook', 'tiktok'] as const).map(r => (
                <Campo key={r} etiqueta={r[0].toUpperCase() + r.slice(1)} tipo="url" valor={b.grupo.redes[r]} alCambiar={v => g({ redes: { ...b.grupo.redes, [r]: v } })} />
              ))}
            </div>
            <h2>Federación / asociación</h2>
            <Lista
              elementos={b.grupo.federacion} alCambiar={federacion => g({ federacion })} nuevo={{ nombre: '', url: '' }} nombre="asociación"
              pintar={(f, set) => (
                <div className="dos-columnas">
                  <Campo etiqueta="Nombre" valor={f.nombre} alCambiar={v => set({ ...f, nombre: v })} />
                  <Campo etiqueta="Web" tipo="url" valor={f.url} alCambiar={v => set({ ...f, url: v })} />
                </div>
              )}
            />
          </>
        )}

        {apartado === 'apariencia' && (
          <>
            <div className="campo">
              <label htmlFor="color">Color principal</label>
              <div className="botones" style={{ alignItems: 'center' }}>
                <input id="color" type="color" value={/^#[0-9a-f]{6}$/i.test(b.apariencia.colorPrincipal) ? b.apariencia.colorPrincipal : '#2f5d50'}
                  onChange={e => ap({ colorPrincipal: e.target.value })} style={{ width: 56, height: 42, border: 0, background: 'none' }} />
                <input className="entrada" style={{ maxWidth: 140 }} aria-label="Color en hexadecimal" value={b.apariencia.colorPrincipal} onChange={e => ap({ colorPrincipal: e.target.value })} />
              </div>
              <small>Mejor un color oscuro: el texto de los botones va en blanco.</small>
            </div>
            <Campo etiqueta="Logo" valor={b.apariencia.logo} alCambiar={v => ap({ logo: v })}
              ayuda="Ruta de un archivo de la carpeta public (por ejemplo /logo.png) o un enlace https:// a la imagen." />
            <ListaUrls etiqueta="Fotos de portada (una por línea; sale una al azar)" valor={b.apariencia.fotosPortada} alCambiar={v => ap({ fotosPortada: v })} />
          </>
        )}

        {apartado === 'inicio' && (
          <>
            <Campo etiqueta="Título de la presentación" valor={b.inicio.titulo} alCambiar={v => setB({ ...b, inicio: { ...b.inicio, titulo: v } })} />
            <Campo etiqueta="Presentación del grupo" multilinea valor={b.inicio.presentacion} alCambiar={v => setB({ ...b, inicio: { ...b.inicio, presentacion: v } })} />
          </>
        )}

        {apartado === 'secciones' && (
          <>
            <p className="suave">
              El <strong>identificador</strong> se usa en los enlaces y para ordenar las secciones en Asistencia: ponle el mismo
              nombre que la sección tiene en el Excel del listado (manada, tropa…).
            </p>
            <Lista
              elementos={b.secciones} alCambiar={secciones => setB({ ...b, secciones })} nuevo={vacio(b.secciones[0] ?? { id: '', nombre: '', rama: '', edades: '', emoji: '', texto: '' })} nombre="sección"
              pintar={(s, set) => (
                <>
                  <div className="dos-columnas">
                    <Campo etiqueta="Nombre" valor={s.nombre} alCambiar={v => set({ ...s, nombre: v })} />
                    <Campo etiqueta="Identificador" valor={s.id} alCambiar={v => set({ ...s, id: v.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
                    <Campo etiqueta="Rama" valor={s.rama} alCambiar={v => set({ ...s, rama: v })} />
                    <Campo etiqueta="Edades" valor={s.edades} alCambiar={v => set({ ...s, edades: v })} />
                    <Campo etiqueta="Emoji" valor={s.emoji} alCambiar={v => set({ ...s, emoji: v })} />
                  </div>
                  <Campo etiqueta="Texto" multilinea valor={s.texto} alCambiar={v => set({ ...s, texto: v })} />
                </>
              )}
            />
          </>
        )}

        {apartado === 'unete' && (
          <>
            <Campo etiqueta="Introducción" multilinea valor={b.unete.intro} alCambiar={v => setB({ ...b, unete: { ...b.unete, intro: v } })} />
            <h2>Pasos para apuntarse</h2>
            <Lista
              elementos={b.unete.pasos} alCambiar={pasos => setB({ ...b, unete: { ...b.unete, pasos } })} nuevo={{ titulo: '', texto: '' }} nombre="paso"
              pintar={(p, set) => (
                <>
                  <Campo etiqueta="Título" valor={p.titulo} alCambiar={v => set({ ...p, titulo: v })} />
                  <Campo etiqueta="Texto" multilinea valor={p.texto} alCambiar={v => set({ ...p, texto: v })} />
                </>
              )}
            />
            <Campo etiqueta="Nota sobre las edades" valor={b.unete.notaEdades} alCambiar={v => setB({ ...b, unete: { ...b.unete, notaEdades: v } })} />
            <Campo etiqueta="Texto para voluntariado (vacío para ocultarlo)" multilinea valor={b.unete.voluntariado} alCambiar={v => setB({ ...b, unete: { ...b.unete, voluntariado: v } })} />
          </>
        )}

        {apartado === 'documentos' && (
          <>
            <p className="suave">Sube cada documento a Google Drive (compartido con «cualquier persona con el enlace») y pega aquí el enlace.</p>
            <Lista
              elementos={b.documentos} alCambiar={documentos => setB({ ...b, documentos })} nuevo={{ titulo: '', descripcion: '', url: '', nota: '' }} nombre="documento"
              pintar={(d, set) => (
                <>
                  <div className="dos-columnas">
                    <Campo etiqueta="Título" valor={d.titulo} alCambiar={v => set({ ...d, titulo: v })} />
                    <Campo etiqueta="Enlace" tipo="url" valor={d.url} alCambiar={v => set({ ...d, url: v })} />
                  </div>
                  <Campo etiqueta="Descripción" valor={d.descripcion} alCambiar={v => set({ ...d, descripcion: v })} />
                  <Campo etiqueta="Nota (opcional)" valor={d.nota} alCambiar={v => set({ ...d, nota: v })} ayuda="Por ejemplo: «Solo para mayores de 12 años»." />
                </>
              )}
            />
          </>
        )}

        {apartado === 'galeria' && (
          <ListaUrls
            etiqueta="Fotos de la galería (un enlace por línea)" valor={b.galeria} alCambiar={galeria => setB({ ...b, galeria })}
            ayuda="Enlaces https:// directos a imágenes, o rutas de archivos subidos a la carpeta public/fotos del proyecto (/fotos/acampada-1.jpg). Ver la guía de instalación."
          />
        )}

        {apartado === 'herramientas' && (
          <Lista
            elementos={b.herramientas} alCambiar={herramientas => setB({ ...b, herramientas })} nuevo={{ emoji: '', titulo: '', texto: '', url: '' }} nombre="guía"
            pintar={(h, set) => (
              <>
                <div className="dos-columnas">
                  <Campo etiqueta="Título" valor={h.titulo} alCambiar={v => set({ ...h, titulo: v })} />
                  <Campo etiqueta="Emoji" valor={h.emoji} alCambiar={v => set({ ...h, emoji: v })} />
                  <Campo etiqueta="Enlace (opcional)" tipo="url" valor={h.url} alCambiar={v => set({ ...h, url: v })} />
                </div>
                <Campo etiqueta="Texto" multilinea valor={h.texto} alCambiar={v => set({ ...h, texto: v })} />
              </>
            )}
          />
        )}

        {apartado === 'equipo' && (
          <>
            <Campo etiqueta="Introducción" multilinea valor={b.equipo.intro} alCambiar={v => setB({ ...b, equipo: { ...b.equipo, intro: v } })} />
            <p className="suave">Pon solo los datos que cada persona haya aceptado publicar.</p>
            <Lista
              elementos={b.equipo.personas} alCambiar={personas => setB({ ...b, equipo: { ...b.equipo, personas } })} nuevo={{ nombre: '', cargo: '' }} nombre="persona"
              pintar={(p, set) => (
                <div className="dos-columnas">
                  <Campo etiqueta="Nombre" valor={p.nombre} alCambiar={v => set({ ...p, nombre: v })} />
                  <Campo etiqueta="Cargo o sección" valor={p.cargo} alCambiar={v => set({ ...p, cargo: v })} />
                </div>
              )}
            />
          </>
        )}

        {apartado === 'lugares' && (
          <>
            <Campo etiqueta="Texto" multilinea valor={b.lugares.texto} alCambiar={v => setB({ ...b, lugares: { ...b.lugares, texto: v } })} />
            <Campo etiqueta="Enlace para insertar el mapa" tipo="url" valor={b.lugares.mapaUrl} alCambiar={v => setB({ ...b, lugares: { ...b.lugares, mapaUrl: v } })}
              ayuda="En Google My Maps: Compartir → Insertar en mi sitio → copia solo la dirección que va dentro de src=&quot;…&quot;." />
          </>
        )}

        {apartado === 'aviso' && (
          <>
            <p className="suave">Una franja arriba de todas las páginas, para anunciar un evento o una noticia.</p>
            <Casilla etiqueta="Mostrar el aviso" valor={b.aviso.activo} alCambiar={v => setB({ ...b, aviso: { ...b.aviso, activo: v } })} />
            <Campo etiqueta="Texto" valor={b.aviso.texto} alCambiar={v => setB({ ...b, aviso: { ...b.aviso, texto: v } })} />
            <div className="dos-columnas">
              <Campo etiqueta="Enlace (opcional)" tipo="url" valor={b.aviso.enlace} alCambiar={v => setB({ ...b, aviso: { ...b.aviso, enlace: v } })} />
              <Campo etiqueta="Texto del enlace" valor={b.aviso.textoEnlace} alCambiar={v => setB({ ...b, aviso: { ...b.aviso, textoEnlace: v } })} />
              <Campo etiqueta="Se oculta solo después del día (opcional)" tipo="date" valor={b.aviso.hasta} alCambiar={v => setB({ ...b, aviso: { ...b.aviso, hasta: v } })} />
            </div>
          </>
        )}

        {apartado === 'paginas' && (
          <>
            <p className="suave">Inicio, Secciones y Únete están siempre. Activa las demás si las vais a usar.</p>
            {([
              ['galeria', 'Galería'], ['documentos', 'Documentos'], ['patrullometro', 'Patrullómetro'],
              ['lugares', 'Lugares de acampada'], ['herramientas', 'Herramientas'], ['equipo', 'Kraal (equipo de scouters)'],
            ] as const).map(([k, nombre]) => (
              <Casilla key={k} etiqueta={nombre} valor={b.paginas[k]} alCambiar={v => setB({ ...b, paginas: { ...b.paginas, [k]: v } })} />
            ))}
          </>
        )}
      </div>

      {conflicto && (
        <div className="mensaje mensaje--error" role="alert">
          <p><strong>{conflicto}</strong> ha publicado cambios mientras editabas.</p>
          <div className="botones" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="boton boton--sec boton--peq" onClick={() => { if (window.confirm('Se perderán tus cambios. ¿Seguro?')) cargar() }}>Ver sus cambios (descarta los tuyos)</button>
            <button type="button" className="boton boton--peligro boton--peq" onClick={() => guardar(true)}>Publicar igualmente (sustituye lo suyo)</button>
          </div>
        </div>
      )}
      {mensaje && <div className={`mensaje mensaje--${mensaje.tipo}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</div>}

      <div className="barra-guardar">
        <div className="contenedor" style={{ padding: 0 }}>
          <span className={pendiente ? '' : 'suave'}>{pendiente ? '● Cambios sin publicar' : 'Todo publicado'}</span>
          <div className="botones">
            <button type="button" className="boton boton--sec" onClick={descargarCopia}>Descargar copia</button>
            <button type="button" className="boton boton--sec" disabled={!pendiente || guardando} onClick={() => { if (window.confirm('¿Descartar los cambios sin publicar?')) cargar() }}>Descartar</button>
            <button type="button" className="boton" disabled={!pendiente || guardando} onClick={() => guardar()}>{guardando ? 'Publicando…' : 'Publicar'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Piezas del formulario ──────────────────────────────────────────────────

function Campo({ etiqueta, valor, alCambiar, multilinea, tipo = 'text', ayuda }: {
  etiqueta: string
  valor: string
  alCambiar: (v: string) => void
  multilinea?: boolean
  tipo?: 'text' | 'email' | 'url' | 'date'
  ayuda?: string
}) {
  const id = useId()
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {multilinea
        ? <textarea id={id} className="area" value={valor} onChange={e => alCambiar(e.target.value)} rows={5} />
        : <input id={id} className="entrada" type={tipo} value={valor} onChange={e => alCambiar(e.target.value)} />}
      {ayuda && <small>{ayuda}</small>}
    </div>
  )
}

function Casilla({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: boolean; alCambiar: (v: boolean) => void }) {
  return (
    <label className="casilla">
      <input type="checkbox" checked={valor} onChange={e => alCambiar(e.target.checked)} />
      {etiqueta}
    </label>
  )
}

/** Lista de enlaces escritos uno por línea. */
function ListaUrls({ etiqueta, valor, alCambiar, ayuda }: { etiqueta: string; valor: string[]; alCambiar: (v: string[]) => void; ayuda?: string }) {
  const [texto, setTexto] = useState(valor.join('\n'))
  useEffect(() => { if (texto.split('\n').map(l => l.trim()).filter(Boolean).join('\n') !== valor.join('\n')) setTexto(valor.join('\n')) },
    // Solo si cambia desde fuera (p. ej. al descartar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valor])
  const id = useId()
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <textarea id={id} className="area" rows={8} value={texto} spellCheck={false}
        onChange={e => { setTexto(e.target.value); alCambiar(e.target.value.split('\n').map(l => l.trim()).filter(Boolean)) }} />
      <small>{valor.length} {valor.length === 1 ? 'enlace' : 'enlaces'}{ayuda && <> · {ayuda}</>}</small>
    </div>
  )
}

/** Lista de elementos con añadir, subir, bajar y quitar. */
function Lista<T>({ elementos, alCambiar, nuevo, nombre, pintar }: {
  elementos: T[]
  alCambiar: (v: T[]) => void
  nuevo: T
  nombre: string
  pintar: (el: T, set: (el: T) => void) => ReactNode
}) {
  const mover = (i: number, d: number) => {
    const v = [...elementos]
    ;[v[i], v[i + d]] = [v[i + d], v[i]]
    alCambiar(v)
  }
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      {elementos.map((el, i) => (
        <div key={i} className="elemento-lista">
          {pintar(el, x => alCambiar(elementos.map((y, j) => (j === i ? x : y))))}
          <div className="elemento-lista__barra">
            <button type="button" className="boton boton--sec boton--peq" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${nombre} ${i + 1}`}>↑</button>
            <button type="button" className="boton boton--sec boton--peq" disabled={i === elementos.length - 1} onClick={() => mover(i, 1)} aria-label={`Bajar ${nombre} ${i + 1}`}>↓</button>
            <button type="button" className="boton boton--peligro boton--peq" onClick={() => { if (window.confirm('¿Quitar este elemento?')) alCambiar(elementos.filter((_, j) => j !== i)) }}>Quitar</button>
          </div>
        </div>
      ))}
      <div><button type="button" className="boton boton--sec" onClick={() => alCambiar([...elementos, nuevo])}>+ Añadir {nombre}</button></div>
    </div>
  )
}
