'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { User, LogOut, KeyRound, X, Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react'

interface Props {
  email: string
  displayName: string
  role: 'master' | 'farmer'
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Menú de usuario en el header. Dropdown con:
 *  - Cambiar contraseña (modal con verificación de password actual)
 *  - Cerrar sesión
 *
 * El cambio de password verifica primero la contraseña actual
 * (re-autenticando), luego llama a updateUser. Si la actual es
 * incorrecta, no se procesa.
 */
export default function UserMenu({ email, displayName, role }: Props) {
  const router = useRouter()
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY)

  const [open, setOpen] = useState(false)
  const [showPwdModal, setShowPwdModal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Menú de usuario"
        >
          <div className="w-7 h-7 rounded-full bg-green-700 text-white flex items-center justify-center text-xs font-semibold">
            {(displayName || email).slice(0, 2).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-green-800 dark:text-green-300 max-w-[180px] truncate">
            {displayName}
          </span>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl py-1 z-30">
            <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</p>
              <span className={`mt-1 inline-block text-[10px] px-1.5 py-0.5 rounded-full ${
                role === 'master'
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
              }`}>
                {role === 'master' ? 'Master corporativo' : 'Agricultor'}
              </span>
            </div>
            <button
              onClick={() => { setOpen(false); setShowPwdModal(true) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2"
            >
              <KeyRound size={14} className="text-gray-500" />
              Cambiar contraseña
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800"
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {showPwdModal && (
        <CambiarPasswordModal
          email={email}
          onClose={() => setShowPwdModal(false)}
        />
      )}
    </>
  )
}

/* ==========================================================================
 * Modal de cambio de contraseña
 * ==========================================================================*/

function CambiarPasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_KEY)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Validaciones
  const minLen = next.length >= 8
  const noSame = next.length > 0 && next !== current
  const matches = next.length > 0 && next === confirm
  const allValid = minLen && noSame && matches && current.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!allValid || loading) return
    setError(null)
    setLoading(true)

    try {
      // 1) Verificar contraseña actual reautenticando
      //    Esto reemplaza la sesión pero el usuario es el mismo,
      //    así que sigue logueado al terminar.
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      })
      if (authErr) {
        setError('La contraseña actual es incorrecta.')
        setLoading(false)
        return
      }

      // 2) Cambiar la contraseña
      const { error: updErr } = await supabase.auth.updateUser({ password: next })
      if (updErr) {
        setError(updErr.message)
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-green-700 dark:text-green-400" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Cambiar contraseña</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-950/50 flex items-center justify-center">
              <Check size={28} className="text-green-700 dark:text-green-400" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Contraseña actualizada</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              La próxima vez que inicies sesión usa tu nueva contraseña.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Cambiarás la contraseña de <strong className="text-gray-700 dark:text-gray-200">{email}</strong>
            </p>

            {/* Contraseña actual */}
            <PwdField
              label="Contraseña actual"
              value={current}
              onChange={setCurrent}
              show={showCurrent}
              onToggleShow={() => setShowCurrent(s => !s)}
              autoFocus
            />

            {/* Nueva contraseña */}
            <PwdField
              label="Nueva contraseña"
              value={next}
              onChange={setNext}
              show={showNext}
              onToggleShow={() => setShowNext(s => !s)}
              hint="Mínimo 8 caracteres"
            />

            {/* Confirmación */}
            <PwdField
              label="Repetir nueva contraseña"
              value={confirm}
              onChange={setConfirm}
              show={showNext}
              onToggleShow={() => setShowNext(s => !s)}
            />

            {/* Validación visual */}
            <div className="space-y-1">
              <ValidationRow ok={minLen} text="Al menos 8 caracteres" />
              <ValidationRow ok={noSame} text="Distinta a la actual" />
              <ValidationRow ok={matches} text="Ambas nuevas coinciden" />
            </div>

            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded p-2 flex items-start gap-1.5">
                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!allValid || loading}
                className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-green-700 hover:bg-green-800 text-white disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function PwdField({
  label, value, onChange, show, onToggleShow, hint, autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggleShow: () => void
  hint?: string
  autoFocus?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:border-green-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label={show ? 'Ocultar' : 'Mostrar'}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function ValidationRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[11px] ${ok ? 'text-green-700 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
      <Check size={11} className={ok ? 'opacity-100' : 'opacity-30'} />
      {text}
    </div>
  )
}
