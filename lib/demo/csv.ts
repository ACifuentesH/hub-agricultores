/**
 * Parser CSV mínimo (RFC4180: comillas dobles, comas y saltos de línea dentro
 * de campos citados) + inferencia de tipo por celda. No hay dependencia nueva
 * a propósito — este módulo solo se usa en DEMO_MODE.
 *
 * Convención de los CSVs en /demo-data (misma que exportó el usuario desde
 * Supabase/pandas): booleans como "True"/"False", nulls como celda vacía,
 * números sin comillas.
 */

function tokenize(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]
    if (inQuotes) {
      if (c === '"') {
        if (normalized[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  // Descarta filas completamente vacías (típico: newline final del archivo)
  return rows.filter(r => !(r.length === 1 && r[0] === ''))
}

function coerce(raw: string): unknown {
  if (raw === '') return null
  if (/^true$/i.test(raw)) return true
  if (/^false$/i.test(raw)) return false
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw)
  return raw
}

export function parseCsv(text: string): Record<string, unknown>[] {
  const rows = tokenize(text)
  if (rows.length === 0) return []
  const header = rows[0]!.map(h => h.trim())
  return rows.slice(1).map(r => {
    const obj: Record<string, unknown> = {}
    header.forEach((h, i) => {
      obj[h] = coerce(r[i] ?? '')
    })
    return obj
  })
}
