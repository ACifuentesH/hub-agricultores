/// <reference lib="webworker" />
/**
 * Service Worker para Polar en el Campo (PWA).
 *
 * Estrategias:
 *   - Static assets (Next chunks, CSS, fuentes): CacheFirst
 *   - Imágenes (incluye iconos PWA): StaleWhileRevalidate
 *   - Pages HTML del App Router: NetworkFirst con fallback a cache
 *   - API y Supabase: SIEMPRE network — datos sensibles no se cachean
 *
 * Build: el manifiesto se inyecta automáticamente por @serwist/next.
 */
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()
