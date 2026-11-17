// Identificador de una patrulla a partir de su nombre (lógica pura, con pruebas).

/** «Patrulla Águila Real» → «patrulla-aguila-real» */
export function idPatrulla(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}
