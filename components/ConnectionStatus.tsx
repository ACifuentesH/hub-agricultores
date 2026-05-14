'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

/**
 * Banner discreto en la parte superior de la app que aparece cuando la
 * conexión cambia de estado:
 *  - Offline: banner ámbar persistente "Sin conexión — viendo data cacheada"
 *  - Vuelve online: banner verde efímero "Conexión restaurada"
 *
 * Detecta cambios via navigator.onLine + eventos online/offline del browser.
 */
export default function ConnectionStatus() {
  const [online, setOnline] = useState(true)
  const [showRestored, setShowRestored] = useState(false)

  useEffect(() => {
    // Estado inicial
    setOnline(navigator.onLine)

    function handleOnline() {
      setOnline(true)
      setShowRestored(true)
      setTimeout(() => setShowRestored(false), 3500)
    }
    function handleOffline() {
      setOnline(false)
      setShowRestored(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (online && !showRestored) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] px-4 py-1.5 text-xs font-medium text-center shadow-md transition-all ${
        online
          ? 'bg-green-600 text-white'
          : 'bg-amber-500 text-white'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-center gap-2">
        {online ? <Wifi size={14} /> : <WifiOff size={14} />}
        {online
          ? 'Conexión restaurada'
          : 'Sin conexión — mostrando última versión cacheada. Algunos datos pueden estar desactualizados.'}
      </div>
    </div>
  )
}
