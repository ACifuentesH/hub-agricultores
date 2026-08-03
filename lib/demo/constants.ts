/**
 * Constantes compartidas entre el cliente mock del servidor (store.ts, que usa
 * `node:fs` y por eso NUNCA se puede importar desde código de browser) y el
 * cliente mock del browser (mock-client-browser.ts). Este archivo no importa
 * nada server-only a propósito, para no arrastrar `node:fs` al bundle del
 * cliente por una cadena de imports.
 */
export const DEMO_USER_ID = 'demo-0000-0000-0000-000000000000'
export const DEMO_USER_EMAIL = 'demo@programasaturno.local'
