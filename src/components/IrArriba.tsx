import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Al cambiar de página, vuelve arriba (salvo si el enlace lleva #ancla). */
export default function IrArriba() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}
