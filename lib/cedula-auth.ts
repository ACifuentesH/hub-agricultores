/**
 * Login por cédula, sin contraseña.
 *
 * Supabase Auth siempre necesita un identificador de tipo email por debajo
 * (GoTrue no soporta "solo un identificador, sin secreto"). Para que el
 * agricultor solo tipee su cédula, se usa un email sintético determinístico
 * — nunca se muestra ni se le pide al usuario — y el login intercambia la
 * cédula por una sesión real vía un magic link generado server-side con
 * `service_role` (ver app/api/auth/cedula-login/route.ts). Esto mantiene
 * `auth.uid()` real para que la RLS funcione igual que con login por clave.
 *
 * ADVERTENCIA DE SEGURIDAD (decisión explícita del usuario, 2026-08-11): la
 * cédula no es secreta en Venezuela — cualquiera que la conozca puede entrar
 * a la cuenta de ese agricultor. Aceptado para un piloto cerrado; no usar así
 * con datos sensibles expuestos a internet sin agregar un segundo factor
 * (PIN, OTP por WhatsApp, etc.).
 */

const DOMINIO = 'login.saturno.internal'

/** Email sintético determinístico — mismo valor siempre para el mismo agricultor_id. */
export function syntheticEmailForAgricultor(agricultorId: string): string {
  return `${agricultorId}@${DOMINIO}`
}

/**
 * Normaliza una cédula a su forma canónica: solo dígitos, sin el prefijo de
 * nacionalidad (V/E/J/G/P) y sin ceros a la izquierda. El agricultor solo
 * tipea el número (ej. "27673399"), no el prefijo ni los ceros que trae el
 * dato de Saturno ("V027673399") — ambos deben normalizar igual para que el
 * login matchee.
 */
export function normalizeCedula(raw: string): string {
  const limpio = raw.trim().toUpperCase().replace(/[.\s-]/g, '')
  const sinPrefijo = limpio.replace(/^[VEJGP]/, '')
  return sinPrefijo.replace(/^0+(?=\d)/, '')
}
