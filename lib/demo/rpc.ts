/**
 * Respuestas canned para las funciones RPC de Postgres que llama el código,
 * en modo demo. Ninguna de las tres es indispensable para las pantallas
 * principales:
 *  - `triangulate_clima`: rama ya muerta en producción (ver AGENTS.md § Sin
 *    triangulación) — `v_clima_efectivo` nunca emite fuente 'triangulated',
 *    así que este código no se alcanza ni con datos reales.
 *  - `match_archivo_a_agricultor`: solo sugiere agricultor al arrastrar un
 *    archivo en el uploader de master; sin sugerencia, master lo asigna a mano.
 *  - `productorhub_config`: credenciales S3 para reenviar documentos a otro
 *    bucket — no aplica sin conexión real, y subir archivos ya está
 *    deshabilitado en modo demo (ver storage mock).
 */
export async function rpcResult(name: string, _args?: Record<string, unknown>) {
  switch (name) {
    case 'triangulate_clima':
    case 'match_archivo_a_agricultor':
      return { data: [] as unknown[], error: null }
    default:
      return { data: null, error: { message: `RPC "${name}" no disponible en modo demo.` } }
  }
}
