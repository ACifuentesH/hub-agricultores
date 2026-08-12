/**
 * Catálogo de categorías del módulo Documentación.
 *
 * Los archivos viven todos en la tabla `documentos` y en el bucket privado
 * `documentos` (proyecto Supabase organizacional), separados por la columna
 * `categoria`. Antes de la migración esto se llamaba `lote_analisis_suelo` /
 * `analisis-suelo` — se renombró porque ya cubre convenios, P&L y análisis de
 * datos, no solo suelo. Ver supabase/migrations/20260812120000_documentos_module.sql.
 *
 * Dato puro a propósito: los iconos se mapean en el componente para que este
 * módulo no dependa de React.
 */

export const CATEGORIAS = [
  {
    id: 'analisis_suelo',
    label: 'Análisis de suelo y agua',
    descripcion: 'Resultados de laboratorio: fertilidad, textura, calidad de agua y recomendaciones.',
  },
  {
    id: 'convenios',
    label: 'Convenios',
    descripcion: 'Contratos y acuerdos del programa de agricultura por contrato.',
  },
  {
    id: 'pnl',
    label: 'P&L',
    descripcion: 'Proyecciones de costos, rendimiento y rentabilidad del ciclo.',
  },
  {
    id: 'analisis_datos',
    label: 'Análisis de datos',
    descripcion: 'Reportes y análisis generados a partir de los datos del ciclo.',
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

/**
 * Tipos y tamaño aceptados por el bucket `documentos`. Compartido entre el
 * filtro del uploader (cliente) y la validación de la ruta de upload
 * (servidor) para que ambos lados nunca se desincronicen.
 */
export const ACEPTADOS_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const
export const MAX_BYTES = 20 * 1024 * 1024 // 20MB, igual al límite del bucket
