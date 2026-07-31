/**
 * Construcción del estado de resultados (P&L) **por finca**.
 *
 * Vive aparte del route handler para que armar el documento no dependa de la
 * sesión ni de la base: el handler resuelve permisos y trae las filas de
 * `pl_unidad`, y aquí solo se maqueta lo que llega.
 *
 * Una fila = una finca (unidad de producción). Los costos de Saturno ya vienen
 * totalizados a ese nivel; no hay desglose por lote.
 */

export interface FilaPL {
  codigo_up: string
  nombre_up: string | null
  ciclo: string
  costo_semillas: number | null
  costo_agroquimicos: number | null
  costo_fertilizantes: number | null
  costo_enmienda: number | null
  costo_mecanizacion: number | null
  costo_servicio_tecnico: number | null
  costo_financiamiento: number | null
  costo_cosecha: number | null
  costo_total: number | null
  ingreso_venta: number | null
  utilidad_agricultor: number | null
  rendimiento_ha: number | null
  ha_totales: number | null
}

export const CONCEPTOS = [
  { etiqueta: 'Semillas', campo: 'costo_semillas' },
  { etiqueta: 'Agroquímicos', campo: 'costo_agroquimicos' },
  { etiqueta: 'Fertilizantes', campo: 'costo_fertilizantes' },
  { etiqueta: 'Enmiendas', campo: 'costo_enmienda' },
  { etiqueta: 'Mecanización', campo: 'costo_mecanizacion' },
  { etiqueta: 'Servicio técnico', campo: 'costo_servicio_tecnico' },
  { etiqueta: 'Financiamiento', campo: 'costo_financiamiento' },
  { etiqueta: 'Cosecha', campo: 'costo_cosecha' },
] as const satisfies readonly { etiqueta: string; campo: keyof FilaPL }[]

const NOTA_SIN_INGRESO =
  'El ciclo aún no registra ingresos por venta, así que la utilidad mostrada refleja ' +
  'únicamente los costos incurridos hasta la fecha. No corresponde a una pérdida ' +
  'definitiva del ciclo.'

const n = (v: unknown) => Number(v ?? 0)
const campo = (f: FilaPL, c: string) => n((f as unknown as Record<string, unknown>)[c])

/**
 * Nombre de la finca. `nombre_up` es el que trae Saturno ("El Loro", "Finca La
 * Padillera"); si viniera vacío, el código de UP al menos ubica al agricultor
 * en cuál de sus unidades está parado.
 */
export const fincaDe = (f: FilaPL) => f.nombre_up?.trim() || f.codigo_up

export function totales(filas: FilaPL[]) {
  const suma = (c: string) => filas.reduce((s, f) => s + campo(f, c), 0)
  const costoTotal = suma('costo_total')
  const haTotales = suma('ha_totales')
  return {
    suma,
    costoTotal,
    haTotales,
    ingreso: suma('ingreso_venta'),
    utilidad: suma('utilidad_agricultor'),
  }
}

export interface MetaPL {
  /** Nombre de la agropecuaria del agricultor */
  nombre: string
  ciclo: string
}

/** Estado de resultados en PDF: una sección por finca y, si hay más de una, un consolidado. */
export async function pdfEstadoResultados(filas: FilaPL[], meta: MetaPL): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const { costoTotal, haTotales, ingreso, utilidad } = totales(filas)
  const doc = new jsPDF()
  const VERDE: [number, number, number] = [22, 101, 52]
  const usd = (v: number) =>
    v.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const finalY = () =>
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 40

  doc.setFontSize(18)
  doc.text('Estado de resultados', 14, 22)
  doc.setFontSize(11)
  doc.setTextColor(90)
  doc.text(meta.nombre, 14, 30)
  doc.setFontSize(9)
  doc.text(
    `Ciclo ${meta.ciclo}  ·  ${filas.length} finca${filas.length === 1 ? '' : 's'}  ·  ` +
      `${haTotales.toLocaleString('es-VE')} ha  ·  Generado el ${new Date().toLocaleDateString('es-VE')}`,
    14,
    36,
  )
  doc.setTextColor(0)

  let y = 46

  for (const f of filas) {
    const ha = n(f.ha_totales)
    const porHa = (v: number) => (ha > 0 ? usd(v / ha) : '—')

    // Salto de página si la sección no cabe entera: partir una finca a la mitad
    // obliga a cruzar páginas para leer un solo estado de resultados.
    if (y > 190) {
      doc.addPage()
      y = 22
    }

    doc.setFontSize(12)
    doc.text(fincaDe(f), 14, y)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(
      `${f.codigo_up}  ·  ${ha.toLocaleString('es-VE')} ha` +
        (f.rendimiento_ha ? `  ·  ${n(f.rendimiento_ha)} t/ha` : ''),
      14,
      y + 5,
    )
    doc.setTextColor(0)

    autoTable(doc, {
      startY: y + 9,
      head: [['Concepto', 'Monto (USD)', 'USD/ha']],
      body: [
        ...CONCEPTOS.map(c => {
          const v = campo(f, c.campo)
          return [c.etiqueta, usd(v), porHa(v)]
        }),
        ['Costo total', usd(n(f.costo_total)), porHa(n(f.costo_total))],
        ['Ingreso por venta', usd(n(f.ingreso_venta)), porHa(n(f.ingreso_venta))],
        ['Utilidad del agricultor', usd(n(f.utilidad_agricultor)), porHa(n(f.utilidad_agricultor))],
      ],
      theme: 'striped',
      headStyles: { fillColor: VERDE },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
      // Las tres últimas filas son totales, no conceptos: van en negrita.
      didParseCell: d => {
        if (d.section === 'body' && d.row.index >= CONCEPTOS.length) {
          d.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: 14, right: 14 },
    })

    y = finalY() + 12
  }

  // Consolidado: solo tiene sentido cuando hay más de una finca que sumar.
  if (filas.length > 1) {
    if (y > 210) {
      doc.addPage()
      y = 22
    }
    doc.setFontSize(12)
    doc.text('Consolidado', 14, y)
    autoTable(doc, {
      startY: y + 4,
      head: [['Concepto', 'Monto (USD)']],
      body: [
        ['Hectáreas totales', haTotales.toLocaleString('es-VE')],
        ['Costo total', usd(costoTotal)],
        ['Ingreso por venta', usd(ingreso)],
        ['Utilidad del agricultor', usd(utilidad)],
        ['Costo por hectárea', haTotales > 0 ? usd(costoTotal / haTotales) : '—'],
      ],
      theme: 'striped',
      headStyles: { fillColor: VERDE },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    })
    y = finalY() + 12
  }

  if (ingreso === 0) {
    if (y > 250) {
      doc.addPage()
      y = 22
    }
    doc.setFontSize(9)
    doc.setTextColor(146, 64, 14)
    doc.text(doc.splitTextToSize(NOTA_SIN_INGRESO, 182), 14, y)
    doc.setTextColor(0)
  }

  return doc.output('arraybuffer')
}

/** Estado de resultados en Excel — reservado al master, que es quien analiza. */
export async function excelEstadoResultados(filas: FilaPL[], meta: MetaPL): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const { suma, costoTotal, haTotales, ingreso, utilidad } = totales(filas)

  const resumen: (string | number)[][] = [
    ['ESTADO DE RESULTADOS'],
    ['Agricultor', meta.nombre],
    ['Ciclo', meta.ciclo],
    ['Fincas', filas.length],
    ['Hectáreas totales', haTotales],
    [],
    ['CONCEPTO', 'MONTO (USD)'],
    ...CONCEPTOS.map(c => [c.etiqueta, suma(c.campo)] as (string | number)[]),
    ['COSTO TOTAL', costoTotal],
    [],
    ['Ingreso por venta', ingreso],
    ['Utilidad del agricultor', utilidad],
    ['Costo por hectárea', haTotales > 0 ? +(costoTotal / haTotales).toFixed(2) : 0],
  ]

  if (ingreso === 0) resumen.push([], ['NOTA'], [NOTA_SIN_INGRESO])

  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.aoa_to_sheet(resumen)
  ws1['!cols'] = [{ wch: 32 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

  const ws2 = XLSX.utils.json_to_sheet(
    filas.map(f => ({
      'Finca': fincaDe(f),
      'Código': f.codigo_up,
      'Hectáreas': n(f.ha_totales),
      ...Object.fromEntries(CONCEPTOS.map(c => [c.etiqueta, campo(f, c.campo)])),
      'Costo total': n(f.costo_total),
      'Ingreso venta': n(f.ingreso_venta),
      'Utilidad': n(f.utilidad_agricultor),
      'Rendimiento (t/ha)': f.rendimiento_ha ?? '',
    })),
  )
  ws2['!cols'] = Array.from({ length: CONCEPTOS.length + 7 }, (_, i) => ({ wch: i <= 1 ? 24 : 15 }))
  XLSX.utils.book_append_sheet(wb, ws2, 'Por finca')

  // `array` y no `buffer`: devuelve un ArrayBuffer, que es lo que NextResponse
  // acepta como cuerpo sin tener que reetiquetar el tipo de Buffer de Node.
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}
