/**
 * Catálogo de categorías del módulo Documentación.
 *
 * Los archivos viven todos en la tabla `lote_analisis_suelo` (nombre histórico:
 * nació solo para PDFs de suelo) y en el bucket privado `analisis-suelo`,
 * separados por la columna `categoria`. Se reutilizó esa infraestructura en
 * lugar de crear tablas/buckets nuevos para conservar las políticas RLS y los
 * 101 PDFs ya cargados.
 *
 * Dato puro a propósito: los iconos se mapean en el componente para que este
 * módulo no dependa de React.
 */

export const CATEGORIAS = [
  {
    id: 'analisis_suelo',
    label: 'Análisis de suelo',
    descripcion: 'Resultados de laboratorio: fertilidad, textura y recomendaciones.',
  },
  {
    id: 'mapas',
    label: 'Mapas',
    descripcion: 'Planos de la finca, poligonales y mapas de lotes.',
  },
  {
    id: 'caso_negocio',
    label: 'Caso de negocio',
    descripcion: 'Proyecciones de costos, rendimiento y rentabilidad del ciclo.',
  },
  {
    id: 'convenios',
    label: 'Convenios',
    descripcion: 'Contratos y acuerdos del programa de agricultura por contrato.',
  },
] as const

export type CategoriaId = (typeof CATEGORIAS)[number]['id']

export const CATEGORIA_DEFAULT: CategoriaId = 'analisis_suelo'

/** Normaliza un valor libre a una categoría válida. */
export function resolveCategoria(raw?: string | null): CategoriaId {
  const v = raw?.trim()
  return CATEGORIAS.some(c => c.id === v) ? (v as CategoriaId) : CATEGORIA_DEFAULT
}

export function labelCategoria(id: string): string {
  return CATEGORIAS.find(c => c.id === id)?.label ?? id
}
