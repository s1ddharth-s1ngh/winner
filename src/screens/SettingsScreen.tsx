import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Moon,
  RefreshCw,
  Sun,
  Trash2,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useLive } from '../app/hooks'
import { usePrefs } from '../app/inbox'
import { useSession } from '../app/session'
import { useTheme, type ThemePref } from '../app/theme'
import { Avatar, Button, Card, Chip, Field, IconButton, PageHeader, SectionTitle, Segmented, cx, rise } from '../components/ui'
import { useToast } from '../components/toast'
import { TimezoneSelect } from '../components/TimezoneSelect'
import { APP, AVATAR_COLORS } from '../config/app'
import { repo } from '../data/repo'
import { timeAgo } from '../lib/dates'
import { connectHealth, healthStatus, isAndroidApp, lastHealthSync, openHealthSettings, syncHealth } from '../native/health'
import ScoringSheet from './sheets/ScoringSheet'

export default function SettingsScreen() {
  const { refresh } = useSession()
  const [rules, setRules] = useState(false)
  return (
    <div className="animate-fade-in">
      <div className="safe-top px-4 pt-3">
        <Link to="/profile">
          <IconButton icon={ArrowLeft} label="Back" />
        </Link>
      </div>
      <PageHeader title="Settings" />
      <div className="px-4">
        <ProfileSection onSaved={refresh} />
        <Appearance />
        <DataSources />
        <Notifications />
        {repo.demo && <DemoTools />}

        <SectionTitle>About</SectionTitle>
        <Card className="divide-y divide-line">
          <Row title="How scoring works" onClick={() => setRules(true)} />
          <Row title={APP.name} text={`Version ${__APP_VERSION__} · ${repo.kind === 'local' ? 'demo mode' : 'connected'}`} />
        </Card>

        <Button variant="danger" icon={LogOut} onClick={() => void repo.signOut()} className="mt-6 w-full">
          Sign out
        </Button>
      </div>
      <ScoringSheet open={rules} onClose={() => setRules(false)} />
    </div>
  )
}

function Row({
  title,
  text,
  onClick,
  right,
}: {
  title: string
  text?: ReactNode
  onClick?: () => void
  right?: ReactNode
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{title}</span>
        {text && <span className="block text-[13px] text-muted">{text}</span>}
      </span>
      {right}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left transition active:bg-surface-2">
      {body}
    </button>
  ) : (
    <div className="flex items-center gap-3 p-4">{body}</div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300',
        checked ? 'bg-brand' : 'bg-surface-3',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 left-0.5 size-6 rounded-full bg-white ring-1 ring-black/5 transition-transform duration-200 ease-out',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

function ProfileSection({ onSaved }: { onSaved: () => Promise<void> }) {
  const { profile } = useSession()
  const toast = useToast()
  const [username, setUsername] = useState(profile.username)
  const [color, setColor] = useState(profile.avatar_color)
  const [timezone, setTimezone] = useState(profile.timezone)
  const [busy, setBusy] = useState(false)
  const dirty = username !== profile.username || color !== profile.avatar_color || timezone !== profile.timezone

  const save = async () => {
    setBusy(true)
    try {
      await repo.saveProfile({ username: username.trim(), avatar_color: color, timezone })
      await onSaved()
      toast('Profile saved')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionTitle>Profile</SectionTitle>
      <Card className="animate-rise p-4">
        <div className="flex items-center gap-4">
          <Avatar name={username || '?'} color={color} src={profile.avatar_url} size={56} />
          <div className="flex gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cx('grid size-7 place-items-center rounded-full transition active:scale-90', color === c && 'ring-2 ring-offset-2 ring-offset-surface')}
                style={{ background: c, ['--tw-ring-color' as string]: c }}
              >
                {color === c && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <Field label="Username" maxLength={20} value={username} onChange={(e) => setUsername(e.target.value)} />
          <TimezoneSelect value={timezone} onChange={setTimezone} />
        </div>
        {dirty && (
          <Button onClick={save} loading={busy} disabled={!username.trim()} className="mt-4 w-full">
            Save changes
          </Button>
        )}
      </Card>
    </>
  )
}

const THEMES: { value: ThemePref; label: ReactNode }[] = [
  { value: 'light', label: <><Sun className="size-4" /> Light</> },
  { value: 'system', label: <><MonitorSmartphone className="size-4" /> System</> },
  { value: 'dark', label: <><Moon className="size-4" /> Dark</> },
]

function Appearance() {
  const { pref, theme, setPref } = useTheme()
  return (
    <>
      <SectionTitle>Appearance</SectionTitle>
      <Card className="animate-rise p-4" style={rise(1)}>
        <div className="mb-4 flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Theme</span>
            <span className="block text-[13px] text-muted">{pref === 'system' ? `Follows your device · now ${theme}` : `Always ${theme}`}</span>
          </span>
        </div>
        <Segmented value={pref} onChange={setPref} options={THEMES} />
      </Card>
    </>
  )
}

function DataSources() {
  return (
    <>
      <SectionTitle>Data sources</SectionTitle>
      <p className="-mt-1 mb-3 px-1 text-[13px] text-muted">Sync automatically, enter data by hand, or both. Manual entries are never overwritten by a sync.</p>
      <div className="space-y-3">
        <GarminCard />
        <AndroidCard />
        <ShortcutCard />
        <Card className="animate-rise" style={rise(4)}>
          <Row title="Manual entry" text="Always available from the + button." right={<Chip tone="steps">On</Chip>} />
        </Card>
      </div>
    </>
  )
}

const GARMIN_KEY_PAGE = 'https://connect.garmin.com/app/settings/personalApiToken'

function GarminCard() {
  const toast = useToast()
  const [version, setVersion] = useState(0)
  const link = useLive(() => repo.getGarmin(), [version])
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const connected = !!link.data

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true)
    try {
      await action()
      setApiKey('')
      toast(done)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
      setVersion((v) => v + 1)
    }
  }
  const disconnect = () =>
    confirm('Disconnect Garmin? Your key is deleted from our server. Data already synced stays.') &&
    void run(() => repo.disconnectGarmin(), 'Garmin disconnected')

  return (
    <Card className="animate-rise p-4" style={rise(1)}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[15px] font-semibold">Garmin Connect</p>
          <p className="text-[13px] text-muted">Steps, floors, sleep and activities straight from your Garmin watch.</p>
        </div>
        {connected && <Chip tone="steps">Connected</Chip>}
      </div>

      {repo.kind === 'local' ? (
        <p className="mt-3 rounded-[18px] bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">Available once the server is connected.</p>
      ) : connected ? (
        <>
          <p className="mt-3 text-[13px] text-ink-2">
            Key ••••{link.data!.key_hint} · syncs automatically every few hours.
          </p>
          {link.data!.last_error && <p className="mt-2 text-[13px] text-danger">{link.data!.last_error}</p>}
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={() => void run(() => repo.syncGarmin(), 'Garmin synced')} loading={busy} icon={RefreshCw} className="h-10 flex-1 text-sm">
              Sync now
            </Button>
            <Button variant="secondary" onClick={disconnect} disabled={busy} className="h-10 text-sm">
              Disconnect
            </Button>
          </div>
          {link.data!.last_sync_at && <p className="mt-2 text-xs text-faint">Last sync {timeAgo(link.data!.last_sync_at)}</p>}
        </>
      ) : (
        <>
          <ol className="mt-4 space-y-1.5 text-[13px] text-ink-2">
            {[
              <>
                Open the{' '}
                <a href={GARMIN_KEY_PAGE} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">
                  Garmin Personal API Key page
                </a>{' '}
                and sign in.
              </>,
              'Tap Create Key, accept the terms, pick an expiry and copy the key.',
              'Paste it here. It is checked with Garmin, then stored encrypted on our server.',
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-steps-soft text-[11px] font-bold text-steps-strong">{i + 1}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
          <Field
            label="Garmin API key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            icon={KeyRound}
            hint="Nobody can read it back, not even you. Delete it any time here or on Garmin Connect."
            className="mt-4"
          />
          <Button
            onClick={() => void run(() => repo.connectGarmin(apiKey), 'Garmin connected')}
            loading={busy}
            disabled={apiKey.trim().length < 8}
            className="mt-3 h-10 w-full text-sm"
          >
            Connect Garmin
          </Button>
        </>
      )}
    </Card>
  )
}

function AndroidCard() {
  const { user, profile } = useSession()
  const toast = useToast()
  const [status, setStatus] = useState<Awaited<ReturnType<typeof healthStatus>> | null>(null)
  const [busy, setBusy] = useState(false)
  const native = isAndroidApp()

  useEffect(() => {
    if (native) void healthStatus().then(setStatus)
  }, [native])

  const connect = async () => {
    setBusy(true)
    try {
      if (status !== 'connected' && !(await connectHealth())) return toast('Permission not granted', 'error')
      setStatus('connected')
      const n = await syncHealth(user.id, profile.timezone, 30)
      toast(n ? `Synced ${n} updates` : 'Already up to date')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const last = lastHealthSync()
  return (
    <Card className="animate-rise p-4" style={rise(2)}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[15px] font-semibold">Android · Health Connect</p>
          <p className="text-[13px] text-muted">Steps and sleep from your phone, Garmin, Samsung, Fitbit…</p>
        </div>
        {native && status === 'connected' && <Chip tone="steps">Connected</Chip>}
      </div>
      {native ? (
        status === 'unavailable' ? (
          <p className="mt-3 text-[13px] text-danger">Health Connect is not available. Install “Health Connect by Android” from the Play Store.</p>
        ) : (
          <div className="mt-4 flex items-center gap-2">
            <Button onClick={connect} loading={busy} icon={RefreshCw} className="h-10 flex-1 text-sm">
              {status === 'connected' ? 'Sync now' : 'Connect Health Connect'}
            </Button>
            {status === 'connected' && (
              <Button variant="secondary" onClick={() => void openHealthSettings()} className="h-10 text-sm">
                Permissions
              </Button>
            )}
          </div>
        )
      ) : (
        <p className="mt-3 rounded-[18px] bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
          Install the {APP.name} Android app to sync automatically. It syncs every time you open it.
        </p>
      )}
      {native && last && <p className="mt-2 text-xs text-faint">Last sync {timeAgo(last)}</p>}
    </Card>
  )
}

function ShortcutCard() {
  const toast = useToast()
  const tokens = useLive(() => repo.listTokens(), [])
  const [fresh, setFresh] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const endpoint = import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-health` : null

  const create = async () => {
    setBusy(true)
    try {
      setFresh(await repo.createToken(`iPhone · ${new Date().toLocaleDateString('en-GB')}`))
    } finally {
      setBusy(false)
    }
  }
  const copy = (text: string, what: string) => void navigator.clipboard.writeText(text).then(() => toast(`${what} copied`))

  return (
    <Card className="animate-rise p-4" style={rise(3)}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-[15px] font-semibold">iPhone · Shortcuts</p>
          <p className="text-[13px] text-muted">An automation sends Apple Health steps and sleep with a personal token.</p>
        </div>
      </div>

      <ol className="mt-4 space-y-1.5 text-[13px] text-ink-2">
        {['Create a token below and copy it.', 'In the Shortcuts app, build the shortcut from the setup guide.', 'Add a daily automation (e.g. every evening and every morning).'].map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-sleep-soft text-[11px] font-bold text-sleep-strong">{i + 1}</span>
            {t}
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-[18px] bg-surface-2 p-3 ring-1 ring-line/60">
        <p className="text-xs font-semibold text-muted">Endpoint</p>
        {endpoint ? (
          <button type="button" onClick={() => copy(endpoint, 'Endpoint')} className="mt-0.5 flex w-full items-center gap-2 text-left">
            <code className="min-w-0 flex-1 truncate text-[12px]">{endpoint}</code>
            <Copy className="size-4 shrink-0 text-muted" />
          </button>
        ) : (
          <p className="mt-0.5 text-[13px] text-muted">Available once the server is connected.</p>
        )}
      </div>

      {fresh && (
        <div className="mt-3 animate-pop rounded-[18px] bg-star-soft p-3 ring-1 ring-star/30">
          <p className="text-xs font-bold text-star-strong">Your new token. It is shown only once.</p>
          <button type="button" onClick={() => copy(fresh, 'Token')} className="mt-1 flex w-full items-center gap-2 text-left">
            <code className="min-w-0 flex-1 text-[12px] break-all">{fresh}</code>
            <Copy className="size-4 shrink-0" />
          </button>
        </div>
      )}

      {tokens.data && tokens.data.length > 0 && (
        <div className="mt-3 divide-y divide-line rounded-[18px] ring-1 ring-line">
          {tokens.data.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <KeyRound className="size-4 text-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{t.label}</p>
                <p className="text-[11px] text-muted">{t.last_used_at ? `Last used ${timeAgo(t.last_used_at)}` : 'Never used'}</p>
              </div>
              <button
                type="button"
                aria-label="Revoke token"
                onClick={() => confirm('Revoke this token? The shortcut using it will stop syncing.') && void repo.revokeToken(t.id)}
                className="p-1 text-faint hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button variant="secondary" icon={KeyRound} onClick={create} loading={busy} className="mt-3 h-10 w-full text-sm">
        Create token
      </Button>
    </Card>
  )
}

function Notifications() {
  const [prefs, setPrefs] = usePrefs()
  const toast = useToast()
  const supported = 'Notification' in window

  const toggleSystem = async (on: boolean) => {
    if (on && Notification.permission !== 'granted') {
      const p = await Notification.requestPermission()
      if (p !== 'granted') return toast('Notifications are blocked for this app', 'error')
    }
    setPrefs({ ...prefs, system: on })
  }

  return (
    <>
      <SectionTitle>Notifications</SectionTitle>
      <Card className="animate-rise divide-y divide-line">
        <Row title="Passed in today's steps" text="When a friend moves above you" right={<Toggle label="Steps overtakes" checked={prefs.steps} onChange={(v) => setPrefs({ ...prefs, steps: v })} />} />
        <Row title="Passed in the overall ranking" text="Steps + sleep + hobby stars" right={<Toggle label="Overall overtakes" checked={prefs.overall} onChange={(v) => setPrefs({ ...prefs, overall: v })} />} />
        {supported && (
          <Row
            title="Phone notifications"
            text="On iPhone, add the app to the Home Screen first."
            right={<Toggle label="Phone notifications" checked={prefs.system} onChange={(v) => void toggleSystem(v)} />}
          />
        )}
      </Card>
    </>
  )
}

function DemoTools() {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <>
      <SectionTitle>Demo</SectionTitle>
      <Card className="divide-y divide-line">
        <Row
          title="Fill my history"
          text="Adds 90 days of sample data (existing days are kept)."
          onClick={async () => {
            setBusy(true)
            await repo.demo!.fillMyHistory(90)
            setBusy(false)
            toast('Sample history added')
          }}
          right={busy ? <span className="size-5 animate-spin rounded-full border-2 border-brand border-t-transparent" /> : undefined}
        />
        <Row
          title="Reset demo"
          text="Deletes every local account and its data."
          onClick={() => confirm('Delete all local demo data on this device?') && repo.demo!.reset()}
        />
      </Card>
    </>
  )
}
