import { CircleCheck, CircleAlert } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),16px)]" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="flex animate-pop items-center gap-2 rounded-full bg-ink py-2.5 pr-5 pl-3.5 text-sm font-semibold text-bg">
            {t.tone === 'ok' ? <CircleCheck className="size-[18px] text-steps" /> : <CircleAlert className="size-[18px] text-danger" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
