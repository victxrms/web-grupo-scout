import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Pagina from '../components/Pagina.tsx'
import { seguirClasificacion, type CambioPuntos } from '../lib/patrullometro.ts'
import type { Patrulla } from '../lib/types.ts'
import { firebaseConfigurado } from '../lib/configurado.ts'
import SinConfigurar from '../components/SinConfigurar.tsx'

const MEDALLAS = ['🥇', '🥈', '🥉']

// Última clasificación vista en este dispositivo: se enseña al momento
// mientras llegan los datos.
const CLAVE_CACHE = 'patrullometro:v1'
function leerCache(): Patrulla[] {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_CACHE) ?? 'null')
    return Array.isArray(datos) ? datos : []
  } catch {
    return []
  }
}

export default function Patrullometro() {
  const [patrullas, setPatrullas] = useState<Patrulla[]>(leerCache)
  const [historial, setHistorial] = useState<CambioPuntos[]>([])
  const [cargando, setCargando] = useState(() => patrullas.length === 0)

  useEffect(() => (!firebaseConfigurado ? undefined : seguirClasificacion(datos => {
    if (datos.patrullas) {
      setPatrullas(datos.patrullas)
      setCargando(false)
      try { localStorage.setItem(CLAVE_CACHE, JSON.stringify(datos.patrullas)) } catch { /* sin almacenamiento */ }
    }
    if (datos.historial) setHistorial(datos.historial)
  })), [])

  return (
    <Pagina ruta="/patrullometro" titulo="Patrullómetro" entradilla="Puntuación de las patrullas. Se actualiza sola.">
      {!firebaseConfigurado ? (
        <SinConfigurar que="El Patrullómetro" />
      ) : cargando ? (
        <p className="suave" role="status">Cargando…</p>
      ) : patrullas.length === 0 ? (
        <p className="suave">Todavía no hay patrullas.</p>
      ) : (
        <ol className="tarjeta" style={{ listStyle: 'none', padding: '0.25rem 1.25rem' }}>
          {patrullas.map((p, i) => (
            <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.8rem 0', borderTop: i ? '1px solid var(--borde)' : 0 }}>
              <span style={{ width: '2rem', textAlign: 'center', fontWeight: 700 }} aria-label={`Puesto ${i + 1}`}>{MEDALLAS[i] ?? i + 1}</span>
              <span className="emoji" aria-hidden="true">{p.emoji}</span>
              <strong style={{ flex: 1, fontSize: '1.1rem' }}>{p.nombre}</strong>
              <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>{p.puntos}</span>
              <span className="suave" style={{ fontSize: '0.85rem' }}>puntos</span>
            </li>
          ))}
        </ol>
      )}

      {historial.length > 0 && (
        <>
          <h2>Últimos cambios</h2>
          <ul className="tarjeta filas" style={{ padding: '0.25rem 1.25rem' }}>
            {historial.map(h => {
              const p = patrullas.find(x => x.id === h.patrulla)
              return (
                <li key={h.id}>
                  <strong>{p ? `${p.emoji} ${p.nombre}` : h.patrulla}</strong>
                  <strong style={{ color: h.cambio >= 0 ? 'var(--exito)' : 'var(--peligro)' }}>{h.cambio >= 0 ? `+${h.cambio}` : h.cambio}</strong>
                  <span style={{ flex: 1, minWidth: '10rem' }}>{h.motivo}</span>
                  <span className="suave" style={{ fontSize: '0.85rem' }}>
                    {h.scouter}{h.fecha && ` · ${h.fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="suave">¿Eres scouter? <Link to="/kraal/patrullometro">Entra para cambiar los puntos</Link></p>
    </Pagina>
  )
}
