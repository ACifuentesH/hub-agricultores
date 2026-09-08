/**
 * Login por documento (cédula / RIF), sin contraseña.
 *
 * Supabase Auth siempre necesita un identificador de tipo email por debajo
 * (GoTrue no soporta "solo un identificador, sin secreto"). Para que el
 * agricultor solo tipee su documento, se usa un email sintético determinístico
 * — nunca se muestra ni se le pide al usuario — y el login intercambia el
 * documento por una sesión real vía un magic link generado server-side con
 * `service_role` (ver app/ingreso/cedula/route.ts). Esto mantiene
 * `auth.uid()` real para que la RLS funcione igual que con login por clave.
 *
 * Personas naturales: cédula (V/E…). Personas jurídicas: RIF (J/G…).
 * El master corporativo ingresa con `MASTER_ACCESS_KEY` en el mismo campo.
 *
 * ADVERTENCIA DE SEGURIDAD (decisión explícita del usuario, 2026-08-11): la
 * cédula/RIF no es secreta en Venezuela — cualquiera que la conozca puede
 * entrar a la cuenta de ese agricultor. Aceptado para un piloto cerrado.
 */

const DOMINIO = 'login.saturno.internal'

/**
 * Clave de acceso del equipo master — se tipea en el mismo campo del
 * documento. Vive en `MASTER_ACCESS_KEY` (.env.local / Vercel), nunca
 * hardcodeada: este archivo se versiona en el repo.
 */
const MASTER_ACCESS_KEY = process.env.MASTER_ACCESS_KEY

/** Email sintético determinístico — mismo valor siempre para el mismo agricultor_id. */
export function syntheticEmailForAgricultor(agricultorId: string): string {
  return `${agricultorId}@${DOMINIO}`
}

/**
 * Normaliza cédula o RIF a forma canónica: solo dígitos, sin prefijo de
 * nacionalidad/tipo (V/E/J/G/P) y sin ceros a la izquierda. Así "V027673399",
 * "27673399", "J-12345678-9" y "123456789" pueden matchear el mismo registro.
 */
export function normalizeCedula(raw: string): string {
  const limpio = raw.trim().toUpperCase().replace(/[.\s-]/g, '')
  const sinPrefijo = limpio.replace(/^[VEJGP]/, '')
  return sinPrefijo.replace(/^0+(?=\d)/, '')
}

/** Prefijo del documento tipado (si viene). */
export function prefijoDocumento(raw: string): string | null {
  const limpio = raw.trim().toUpperCase().replace(/[.\s-]/g, '')
  const m = limpio.match(/^([VEJGP])/)
  return m?.[1] ?? null
}

/**
 * Etiqueta según el documento: naturales (V/E o solo dígitos) → Cédula;
 * jurídicos (J/G/P) → RIF.
 */
export function labelDocumento(raw: string): 'Cédula' | 'RIF' {
  const p = prefijoDocumento(raw)
  if (p === 'J' || p === 'G' || p === 'P') return 'RIF'
  return 'Cédula'
}

export function esClaveMaster(raw: string): boolean {
  if (!MASTER_ACCESS_KEY) return false
  return raw.trim().toUpperCase() === MASTER_ACCESS_KEY.toUpperCase()
}
