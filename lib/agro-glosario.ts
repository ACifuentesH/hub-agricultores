/**
 * Glosario agronómico en lenguaje llano.
 *
 * Es la base de conocimiento del asistente propio: textos escritos por humanos,
 * no generados. El asistente los combina con los datos reales del productor, de
 * modo que nunca inventa cifras ni recomendaciones.
 *
 * Las descripciones cortas de fase vivían dentro de app/(app)/cultivo/page.tsx;
 * se centralizaron aquí para que página y asistente digan exactamente lo mismo.
 */

import type { Stage } from './corn-stages'

/**
 * Preguntas que el asistente sabe responder. Viven aquí y no en lib/asistente.ts
 * porque el widget es un componente cliente: importar desde el motor arrastraría
 * el cliente de Supabase de servidor al bundle del navegador.
 */
export const PREGUNTAS_SUGERIDAS = [
  '¿En qué etapa está mi cultivo?',
  '¿Qué es el llenado de grano?',
  '¿Qué documentos tengo cargados?',
  '¿Cómo está el clima en mi finca?',
  '¿Tengo alertas esta semana?',
]

/** Descripción corta de la fase — usada en las tarjetas de Cultivo. */
export const FASE_CORTA: Record<Stage, string> = {
  0: 'Emergencia y germinación: monitorea humedad superficial.',
  1: 'Establecimiento: plántulas con primeras hojas verdaderas.',
  2: 'Crecimiento vegetativo activo, alto consumo de nitrógeno.',
  3: 'Floración y polinización: etapa crítica para el rendimiento.',
  4: 'Llenado de grano: hidratación y sanidad determinan el peso.',
  5: 'Madurez fisiológica: planificar la cosecha en los próximos días.',
}

/** Explicación extendida por etapa — la que da el asistente cuando preguntan. */
export const FASE_EXPLICACION: Record<Stage, string> = {
  0: 'En germinación (V0) la semilla absorbe agua y emerge la plántula. Lo que más importa es la humedad de los primeros centímetros del suelo: si se seca, la emergencia queda despareja y se pierde población.',
  1: 'En establecimiento (V3–V6) la planta define cuántas hojas y raíces tendrá. Es el momento de asegurar el control de malezas: la competencia temprana cuesta rendimiento que después no se recupera.',
  2: 'En crecimiento vegetativo (V7–V10) la planta crece rápido y consume mucho nitrógeno. Es la ventana típica para el abonado de cobertura, antes de que el cultivo cierre calle.',
  3: 'En floración (V12–VT) salen la espiga y los estigmas, y ocurre la polinización. Es la etapa MÁS crítica del ciclo: un golpe de calor o falta de agua en estos días reduce directamente el número de granos, y eso ya no se recupera.',
  4: 'En llenado de grano (R1–R4) la planta mueve azúcares y almidón hacia el grano, que gana peso día a día. Es la etapa de mayor demanda de agua: un déficit ahora da granos livianos y baja el rendimiento final. También conviene vigilar enfermedades de hoja, porque la hoja es la fábrica que llena el grano.',
  5: 'En madurez (R6) el grano llegó a su peso máximo y aparece la capa negra en su base. Ya no gana peso: a partir de aquí lo que importa es la humedad del grano para decidir la fecha de cosecha.',
}

/** Sinónimos que el usuario puede escribir para referirse a cada etapa. */
export const ETAPA_ALIAS: { stage: Stage; palabras: string[] }[] = [
  { stage: 0, palabras: ['germinacion', 'emergencia', 'v0'] },
  { stage: 1, palabras: ['establecimiento', 'plantula', 'v3', 'v6'] },
  { stage: 2, palabras: ['vegetativo', 'crecimiento', 'v7', 'v10'] },
  { stage: 3, palabras: ['floracion', 'polinizacion', 'espiga', 'vt'] },
  { stage: 4, palabras: ['llenado', 'llenado de grano', 'r1', 'r4'] },
  { stage: 5, palabras: ['madurez', 'cosecha', 'r6', 'capa negra'] },
]

/** Qué significa cada sección del módulo Documentación. */
export const DOC_EXPLICACION: Record<string, string> = {
  analisis_suelo: 'Los análisis de suelo son los resultados del laboratorio: pH, materia orgánica, fósforo, potasio y textura. Sirven para decidir el encalado y la fórmula de fertilización.',
  mapas: 'Los mapas son los planos de la finca: poligonales de los lotes, superficies y ubicación.',
  caso_negocio: 'El caso de negocio reúne las proyecciones de costos, rendimiento esperado y rentabilidad del ciclo.',
  convenios: 'Los convenios son los contratos y acuerdos firmados dentro del programa de agricultura por contrato.',
}

/** Cómo se obtuvo el dato de clima, explicado sin jerga. */
export const FUENTE_EXPLICACION: Record<string, string> = {
  davis: 'Este dato viene de una estación Davis física asignada a tu finca, así que es una medición directa.',
  triangulated: 'Tu finca no tiene estación propia, así que el dato se estima combinando las estaciones cercanas según su distancia (triangulación). Es una aproximación, no una medición en tu lote.',
  sin_datos: 'Todavía no hay estación asignada ni coordenadas cargadas para tu finca, así que no puedo mostrar clima.',
}
