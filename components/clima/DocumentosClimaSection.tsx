import { CloudDownload } from 'lucide-react'

/**
 * Placeholder de la sección de documentos meteorológicos de /clima
 * (reportes/boletines que llegan por fuera de la app y todavía no tienen
 * flujo de carga propio — a diferencia de Documentación, que sí tiene
 * categorías con upload). Solo identifica el espacio por ahora; cuando haya
 * un origen definido para esos documentos se conecta como una sección más,
 * igual que las de Documentación (`lib/documentos.ts` § CATEGORIAS).
 */
export default function DocumentosClimaSection() {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        Documentos meteorológicos
      </h2>
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-900">
        <CloudDownload size={16} className="mt-0.5 shrink-0 text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Acá van a vivir los reportes y boletines meteorológicos de la finca. Todavía no
          hay carga habilitada — este espacio queda identificado mientras se define de
          dónde salen esos documentos.
        </p>
      </div>
    </section>
  )
}
