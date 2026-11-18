import { ArrowRight, Eye, EyeOff, Footprints, Lock, Mail, MoonStar, Trophy } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { APP } from '../config/app'
import { repo } from '../data/repo'
import { Button, Field, Segmented } from '../components/ui'

/** Solid brand header with the app name and what it tracks. */
function Hero() {
  return (
    <div className="relative overflow-hidden bg-hero px-6 pt-[max(env(safe-area-inset-top),28px)] pb-16 text-white">
      <div className="relative mt-10 animate-pop">
        <img src="/pwa-192x192.png" alt="" className="size-16 rounded-[20px] ring-1 ring-white/20" />
        <h1 className="mt-6 text-[38px] leading-[1.02] font-black tracking-[-0.04em]">{APP.name}</h1>
        <p className="mt-3 max-w-[18rem] text-[15px] leading-relaxed text-white/80">{APP.tagline}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { icon: Footprints, label: 'Steps' },
            { icon: MoonStar, label: 'Sleep' },
            { icon: Trophy, label: 'Friends' },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/15">
              <Icon className="size-4" /> {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (mode === 'up' && password.length < 8) return setError('Use at least 8 characters for your password.')
    setBusy(true)
    try {
      await (mode === 'in' ? repo.signIn(email, password) : repo.signUp(email, password))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <Hero />
      <form onSubmit={submit} className="safe-bottom relative -mt-8 flex flex-1 animate-sheet-in flex-col rounded-t-[34px] bg-bg px-6 pt-7">
        <Segmented
          value={mode}
          onChange={(m) => (setMode(m), setError(null))}
          options={[
            { value: 'in', label: 'Sign in' },
            { value: 'up', label: 'Create account' },
          ]}
        />
        <div className="mt-6 space-y-4">
          <Field
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password"
            icon={Lock}
            type={show ? 'text' : 'password'}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder={mode === 'up' ? 'At least 8 characters' : 'Your password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button type="button" onClick={() => setShow(!show)} className="text-faint hover:text-ink-2" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            }
          />
        </div>
        {error && <p className="mt-4 rounded-[20px] bg-danger-soft px-4 py-3 text-sm font-medium text-danger" role="alert">{error}</p>}
        <Button type="submit" loading={busy} className="mt-6 w-full">
          {mode === 'in' ? 'Sign in' : 'Create account'}
          <ArrowRight className="size-[18px]" />
        </Button>
        <p className="mt-4 text-center text-[13px] text-muted">
          {mode === 'in' ? 'New here? ' : 'Already have an account? '}
          <button type="button" className="font-semibold text-brand" onClick={() => (setMode(mode === 'in' ? 'up' : 'in'), setError(null))}>
            {mode === 'in' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <div className="flex-1" />
        {repo.kind === 'local' && (
          <p className="mt-8 mb-2 rounded-[20px] bg-surface-2 px-4 py-3 text-center text-xs leading-relaxed text-muted">
            <span className="font-semibold text-ink-2">Demo mode.</span> Accounts and data are stored only on this device until the server is connected.
          </p>
        )}
      </form>
    </div>
  )
}
