import { ArrowRight, Check, Hash, Plus, Sparkles, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { AVATAR_COLORS } from '../config/app'
import { repo } from '../data/repo'
import { DEMO_GROUP_CODE } from '../data/demoSeed'
import { useSession } from '../app/session'
import { Avatar, Button, Card, Field, IconTile, cx, rise } from '../components/ui'
import { TimezoneSelect } from '../components/TimezoneSelect'

/** Shown after sign-up until the user belongs to a group. */
export default function Onboarding() {
  const { profile, refresh } = useSession()
  const [step, setStep] = useState<'profile' | 'group'>('profile')
  const [username, setUsername] = useState(profile.username)
  const [color, setColor] = useState(profile.avatar_color)
  const [timezone, setTimezone] = useState(profile.timezone)
  const [groupName, setGroupName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('profile')
    try {
      await repo.saveProfile({ username: username.trim(), avatar_color: color, timezone })
      setStep('group')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const run = (key: string, fn: () => Promise<unknown>) => async (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    setBusy(key)
    try {
      await fn()
      await refresh()
    } catch (err) {
      setError((err as Error).message)
      setBusy(null)
    }
  }

  return (
    <div className="safe-top safe-bottom mx-auto flex min-h-dvh max-w-md flex-col px-5">
      <div className="mt-4 flex gap-1.5">
        {['profile', 'group'].map((s, i) => (
          <span key={s} className={cx('h-1.5 flex-1 rounded-full transition', i <= (step === 'profile' ? 0 : 1) ? 'bg-[linear-gradient(90deg,var(--brand),var(--brand-2))]' : 'bg-surface-3')} />
        ))}
      </div>

      {step === 'profile' ? (
        <form onSubmit={saveProfile} className="flex flex-1 animate-fade-in flex-col">
          <p className="mt-8 text-[13px] font-semibold text-brand">Step 1 of 2</p>
          <h1 className="mt-1 text-[32px] font-extrabold tracking-[-0.03em]">Make it yours</h1>
          <p className="mt-1 text-[15px] text-muted">This is how your friends will see you in the rankings.</p>

          <div className="mt-8 flex justify-center">
            <div className="relative">
              <span className="absolute inset-0 scale-125 rounded-full blur-2xl" style={{ background: color, opacity: 0.35 }} />
              <Avatar name={username || '?'} color={color} size={104} />
              <span className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full bg-star text-white ring-4 ring-bg">
                <Sparkles className="size-4" />
              </span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={cx('grid size-9 place-items-center rounded-full transition active:scale-90', color === c && 'ring-2 ring-offset-2 ring-offset-bg')}
                style={{ background: c, ['--tw-ring-color' as string]: c }}
              >
                {color === c && <Check className="size-4 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-4">
            <Field label="Username" required maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. Samar" />
            <TimezoneSelect value={timezone} onChange={setTimezone} />
          </div>
          {error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}
          <div className="flex-1" />
          <Button type="submit" loading={busy === 'profile'} disabled={!username.trim()} className="mt-8 mb-2 w-full">
            Continue <ArrowRight className="size-[18px]" />
          </Button>
        </form>
      ) : (
        <div className="flex flex-1 animate-fade-in flex-col">
          <p className="mt-8 text-[13px] font-semibold text-brand">Step 2 of 2</p>
          <h1 className="mt-1 text-[32px] font-extrabold tracking-[-0.03em]">Join your crew</h1>
          <p className="mt-1 text-[15px] text-muted">Rankings are per group. Create one and share the code, or join a friend's.</p>

          <Card className="mt-7 animate-rise p-5">
            <form onSubmit={run('create', () => repo.createGroup(groupName))}>
              <div className="mb-4 flex items-center gap-3">
<IconTile icon={Plus} tone="brand" size={44} />
                <div>
                  <h2 className="font-bold">Create a group</h2>
                  <p className="text-[13px] text-muted">You'll get an invite code to share.</p>
                </div>
              </div>
              <Field label="Group name" required maxLength={40} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Early Birds" />
              <Button type="submit" loading={busy === 'create'} disabled={!groupName.trim()} className="mt-4 w-full">
                Create group
              </Button>
            </form>
          </Card>

          <Card style={rise(1)} className="mt-4 animate-rise p-5">
            <form onSubmit={run('join', () => repo.joinGroup(code))}>
              <div className="mb-4 flex items-center gap-3">
<IconTile icon={Users} tone="steps" size={44} />
                <div>
                  <h2 className="font-bold">Join with a code</h2>
                  <p className="text-[13px] text-muted">Ask a friend for their 6-character code.</p>
                </div>
              </div>
              <Field
                label="Invite code"
                icon={Hash}
                required
                maxLength={6}
                autoCapitalize="characters"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="[&_input]:font-semibold [&_input]:tracking-[0.3em]"
              />
              <Button type="submit" variant="secondary" loading={busy === 'join'} disabled={code.trim().length < 6} className="mt-4 w-full">
                Join group
              </Button>
            </form>
          </Card>

          {error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}

          {repo.kind === 'local' && (
            <button
              type="button"
              onClick={() => void run('demo', () => repo.joinGroup(DEMO_GROUP_CODE))()}
              className="mx-auto mt-6 mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
            >
              <Sparkles className="size-4" /> Try the demo group with sample friends
            </button>
          )}
        </div>
      )}
    </div>
  )
}
