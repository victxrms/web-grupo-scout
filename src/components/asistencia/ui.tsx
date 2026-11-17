// Piezas pequeñas compartidas por las pestañas de asistencia.
import { estadoDeuda } from '../../lib/asistencia/cuotas.ts'

const ICONO = { debe: '⚠', 'al-dia': '✓', 'a-favor': '＋' } as const

/**
 * Estado de la deuda con color, icono y texto, para que se distinga sin
 * depender del color: "⚠ Debe 3,00 €", "✓ Al día", "＋ 1,50 € a favor".
 */
export function EstadoCuotas({ deuda, prefijo }: { deuda: number; prefijo?: string }) {
  const e = estadoDeuda(deuda)
  return (
    <span className={`asis-estado asis-estado--${e.tipo}`}>
      <span aria-hidden="true">{ICONO[e.tipo]}</span>
      {prefijo && <span className="sr-only">{prefijo} </span>}
      {e.texto}
    </span>
  )
}

export function Aviso({ tipo, children }: { tipo: 'ok' | 'error' | 'info'; children: React.ReactNode }) {
  // role=alert para errores (se anuncian al momento); status para el resto.
  return (
    <div className={`asis-aviso asis-aviso--${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
