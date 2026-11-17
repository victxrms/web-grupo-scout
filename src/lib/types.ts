import type { Timestamp } from 'firebase/firestore'

export interface Patrulla {
  id: string
  nombre: string
  emoji: string
  puntos: number
}

export interface HistorialEntry {
  id: string
  patrulla: string
  cambio: number
  motivo: string
  scouter: string
  fecha: Timestamp | null
}
