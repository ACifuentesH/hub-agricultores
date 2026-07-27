'use client'

import { useEffect } from 'react'

/**
 * Fuerza la comprobación de actualizaciones del service worker al abrir la app.
 *
 * Por qué existe: durante un tiempo el middleware interceptó `/sw.js` y devolvía
 * una redirección a /login en lugar del archivo. Los navegadores que instalaron
 * la PWA en ese periodo quedaron con un worker viejo que no podía actualizarse
 * solo, sirviendo una versión anterior de la app (rutas y estilos que ya no
 * existen). Al arreglar el middleware el worker ya puede descargarse, pero el
 * navegador solo revisa actualizaciones de forma esporádica; esto lo pide de
 * inmediato.
 *
 * Cuando el worker nuevo toma el control (skipWaiting + clientsClaim en sw.ts),
 * se recarga una única vez para que la página quede servida por él. El guard de
 * `recargado` evita cualquier bucle de recarga.
 */
export default function ServiceWorkerRefresh() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    let recargado = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recargado) return
      recargado = true
      window.location.reload()
    })

    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => {
        reg.update().catch(() => {
          /* sin red o worker no disponible: se reintenta en la próxima visita */
        })
      })
    }).catch(() => {})
  }, [])

  return null
}
