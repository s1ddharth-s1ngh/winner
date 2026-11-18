import { Camera, Check, ChevronRight, ImagePlus, Lock, Paintbrush, Settings, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMyData, useToday } from '../app/hooks'
import { useSession } from '../app/session'
import { useToast } from '../components/toast'
import { Avatar, Button, Card, SectionTitle, Sheet, Skeleton, cx, rise } from '../components/ui'
import { AVATAR_COLORS } from '../config/app'
import { BADGES, type BadgeTone } from '../config/badges'
import { repo, type ProfileInput } from '../data/repo'
import { toJpeg } from '../lib/image'
import { longestStreak, qualifiesSleep, qualifiesSteps } from '../domain/scoring'
import { addDays, formatDayShort, formatMonth } from '../lib/dates'
import { formatNumber } from '../lib/format'

const TONE: Record<BadgeTone, string> = {
  steps: 'bg-steps',
  sleep: 'bg-sleep',
  star: 'bg-star',
  hobby: 'bg-hobby',
  brand: 'bg-brand',
}

export default function ProfileScreen() {
  const { profile, groups } = useSession()
  const today = useToday()
  const { data } = useMyData(addDays(today, -400), today)
  const history = data?.history
  const badges = history ? BADGES.map((b) => ({ ...b, at: b.earned(history), prog: b.progress?.(history) })) : null
  const earned = badges?.filter((b) => b.at) ?? []
  const [editing, setEditing] = useState(false)

  return (
    <div className="animate-fade-in">
      <div
        className="relative h-48 overflow-hidden rounded-b-[36px] bg-hero bg-cover bg-center"
        style={{ backgroundColor: profile.cover_color ?? undefined, backgroundImage: profile.cover_url ? `url("${profile.cover_url}")` : undefined }}
      >
        <div className="safe-top absolute top-0 right-4 flex gap-2">
          <button type="button" aria-label="Customize profile" onClick={() => setEditing(true)} className={HERO_BTN}>
            <Paintbrush className="size-[18px]" />
          </button>
          <Link to="/settings" aria-label="Settings" className={HERO_BTN}>
            <Settings className="size-[19px]" />
          </Link>
        </div>
      </div>
      <div className="relative z-10 -mt-14 flex flex-col items-center px-5 text-center">
        <button type="button" aria-label="Change profile photo" onClick={() => setEditing(true)} className="relative rounded-full">
          <Avatar name={profile.username} color={profile.avatar_color} src={profile.avatar_url} size={100} ring />
          <span className="absolute right-0.5 bottom-0.5 grid size-8 place-items-center rounded-full bg-surface text-ink-2 ring-[3px] ring-bg">
            <Camera className="size-4" />
          </span>
        </button>
        <h1 className="mt-3 text-[28px] font-extrabold tracking-[-0.03em]">{profile.username}</h1>
        <p className="text-[13px] text-muted">
          Member since {formatMonth(profile.created_at.slice(0, 10))} · {profile.timezone.replace(/_/g, ' ')}
        </p>
      </div>

      <div className="px-4">
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: 'Stars', value: history ? formatNumber(history.reduce((s, d) => s + d.total, 0)) : '–' },
            { label: 'Badges', value: badges ? `${earned.length}/${BADGES.length}` : '–' },
            { label: 'Best streak', value: history ? `${Math.max(longestStreak(history, qualifiesSteps), longestStreak(history, qualifiesSleep))}d` : '–' },
          ].map((k, i) => (
            <Card key={k.label} style={rise(i)} className="animate-rise px-3 py-4 text-center">
              <p className="display text-[22px]">{k.value}</p>
              <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{k.label}</p>
            </Card>
          ))}
        </div>

        <SectionTitle>Badges</SectionTitle>
        {!badges ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {badges.map((b, i) => (
              <Card key={b.id} style={rise(i)} className={cx('flex animate-rise flex-col items-center p-3 text-center', !b.at && 'opacity-80')}>
                <span
                  className={cx(
                    'relative grid size-14 place-items-center rounded-2xl text-white',
                    b.at ? TONE[b.tone] : 'bg-surface-2 text-faint',
                  )}
                  title={b.description}
                >
                  <b.icon className="size-7" strokeWidth={2} />
                  {!b.at && (
                    <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full bg-surface-3 text-ink-2 ring-2 ring-surface">
                      <Lock className="size-3" strokeWidth={2.5} />
                    </span>
                  )}
                </span>
                <p className={cx('mt-2 text-[13px] leading-tight font-bold', !b.at && 'text-muted')}>{b.name}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{b.at ? `Earned ${formatDayShort(b.at)}` : b.description}</p>
                {!b.at && b.prog && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.min(100, (b.prog[0] / b.prog[1]) * 100)}%` }} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <SectionTitle>Groups</SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          <Link to="/groups" className="flex items-center gap-3 p-4">
            <span className="flex-1">
              <span className="block font-semibold">Your groups</span>
              <span className="block text-[13px] text-muted">{groups.map((g) => g.name).join(', ')}</span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </Link>
          <Link to="/settings" className="flex items-center gap-3 p-4">
            <span className="flex-1">
              <span className="block font-semibold">Settings</span>
              <span className="block text-[13px] text-muted">Profile, data sources, notifications</span>
            </span>
            <ChevronRight className="size-5 text-faint" />
          </Link>
        </Card>
      </div>
      <CustomizeSheet open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}

// Dark glass so the buttons stay readable on any cover color or photo.
const HERO_BTN =
  'mt-3 grid size-10 place-items-center rounded-full bg-black/20 text-white ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-black/30'

function CustomizeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refresh } = useSession()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const picking = useRef<'avatar' | 'cover'>('avatar')

  const save = async (key: string, fn: () => Promise<ProfileInput>) => {
    setBusy(key)
    try {
      await repo.saveProfile(await fn())
      await refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const pick = (kind: 'avatar' | 'cover') => {
    picking.current = kind
    fileInput.current?.click()
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    const kind = picking.current
    save(`${kind}-upload`, async () => {
      const jpeg = await (kind === 'avatar' ? toJpeg(file, 400, 400) : toJpeg(file, 1200, 600))
      const url = await repo.uploadProfileImage(kind, jpeg)
      return kind === 'avatar' ? { avatar_url: url } : { cover_url: url }
    })
  }

  // Null = the app's default hero color.
  const coverColors = [null, ...AVATAR_COLORS]

  return (
    <Sheet open={open} onClose={onClose} title="Customize profile">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Profile photo</p>
      <div className="flex items-center gap-3">
        <Avatar name={profile.username} color={profile.avatar_color} src={profile.avatar_url} size={56} />
        <Button variant="secondary" icon={ImagePlus} loading={busy === 'avatar-upload'} onClick={() => pick('avatar')} className="flex-1">
          {profile.avatar_url ? 'Change' : 'Upload'}
        </Button>
        {profile.avatar_url && (
          <Button
            variant="secondary"
            aria-label="Remove profile photo"
            icon={Trash2}
            loading={busy === 'avatar-remove'}
            onClick={() => save('avatar-remove', async () => ({ avatar_url: null }))}
            className="px-4"
          />
        )}
      </div>

      <p className="mt-6 mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">Cover</p>
      <div className="flex flex-wrap gap-2.5">
        {coverColors.map((c) => {
          const selected = !profile.cover_url && profile.cover_color === c
          return (
            <button
              key={c ?? 'default'}
              type="button"
              aria-label={c ? `Cover color ${c}` : 'Default cover color'}
              aria-pressed={selected}
              disabled={busy != null}
              // Picking a color replaces the cover photo.
              onClick={() => save('color', async () => ({ cover_color: c, cover_url: null }))}
              className={cx('grid size-9 place-items-center rounded-full bg-hero transition active:scale-90', selected && 'ring-2 ring-offset-2 ring-offset-bg')}
              style={{ backgroundColor: c ?? undefined, ['--tw-ring-color' as string]: c ?? 'var(--hero)' }}
            >
              {selected && <Check className="size-4 text-white" strokeWidth={3} />}
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="secondary" icon={ImagePlus} loading={busy === 'cover-upload'} onClick={() => pick('cover')} className="flex-1">
          {profile.cover_url ? 'Change cover photo' : 'Upload cover photo'}
        </Button>
        {profile.cover_url && (
          <Button
            variant="secondary"
            aria-label="Remove cover photo"
            icon={Trash2}
            loading={busy === 'cover-remove'}
            onClick={() => save('cover-remove', async () => ({ cover_url: null }))}
            className="px-4"
          />
        )}
      </div>
    </Sheet>
  )
}
