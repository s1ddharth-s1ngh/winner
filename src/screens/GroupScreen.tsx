import { ArrowLeft, Check, Copy, Crown, Hash, LogOut, Plus, Share2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useLive } from '../app/hooks'
import { useSession } from '../app/session'
import { Avatar, Button, Card, Chip, Field, IconButton, PageHeader, SectionTitle, Sheet, Skeleton, cx, rise } from '../components/ui'
import { useToast } from '../components/toast'
import { APP } from '../config/app'
import { repo } from '../data/repo'
import { formatDayShort } from '../lib/dates'
import { inviteUrl } from '../lib/invite'

export default function GroupScreen() {
  const { user, group, groups, selectGroup, refresh } = useSession()
  const toast = useToast()
  const members = useLive(() => (group ? repo.listMembers(group.id) : Promise.resolve([])), [group?.id])
  const [copied, setCopied] = useState(false)
  const [sheet, setSheet] = useState<'create' | 'join' | null>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!group) return null
  const inviteText = `Join my group "${group.name}" on ${APP.name}! Invite code: ${group.invite_code}`
  const link = inviteUrl(group.invite_code)

  const copy = async () => {
    await navigator.clipboard.writeText(group.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const share = async () => {
    if (navigator.share) await navigator.share({ title: APP.name, text: inviteText, url: link }).catch(() => {})
    else {
      await navigator.clipboard.writeText(`${inviteText}\n${link}`)
      toast('Invite link copied')
    }
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const g = sheet === 'create' ? await repo.createGroup(value) : await repo.joinGroup(value)
      selectGroup(g.id)
      toast(sheet === 'create' ? 'Group created' : `Joined ${g.name}`)
      setSheet(null)
      setValue('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const leave = async () => {
    if (!confirm(`Leave "${group.name}"? Your data stays, but you will disappear from its ranking.`)) return
    await repo.leaveGroup(group.id)
    localStorage.removeItem('wfl:group')
    await refresh()
    toast(`You left ${group.name}`)
  }

  return (
    <div className="animate-fade-in">
      <div className="safe-top px-4 pt-3">
        <Link to="/profile">
          <IconButton icon={ArrowLeft} label="Back" />
        </Link>
      </div>
      <PageHeader subtitle="Group" title={group.name} />
      <div className="px-4">
        {/* Plain div: Card's surface-card background would override bg-hero. */}
        <div className="animate-rise rounded-[26px] bg-hero p-5 text-white">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">Invite code</p>
            <p className="mt-2 font-mono text-[36px] leading-none font-bold tracking-[0.25em]">{group.invite_code}</p>
            <p className="mt-1 text-[13px] text-white/70">Share the link, or friends enter this code after signing up.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={copy} className="inline-flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold ring-1 ring-white/20 transition-colors hover:bg-white/20">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" onClick={share} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-brand transition-colors hover:bg-white/90">
                <Share2 className="size-4" /> Share invite
              </button>
            </div>
          </div>
        </div>

        <SectionTitle>{members.data ? `${members.data.length} members` : 'Members'}</SectionTitle>
        <Card className="animate-rise divide-y divide-line" style={rise(1)}>
          {!members.data
            ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="m-3 h-10" />)
            : [...members.data]
                .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.profile.username.localeCompare(b.profile.username)))
                .map((m) => (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={m.profile.username} color={m.profile.avatar_color} src={m.profile.avatar_url} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {m.profile.username}
                        {m.user_id === user.id && <span className="ml-1.5 text-xs font-semibold text-brand">You</span>}
                      </p>
                      <p className="text-xs text-muted">Joined {formatDayShort(m.joined_at.slice(0, 10))}</p>
                    </div>
                    {m.role === 'owner' && (
                      <Chip tone="star">
                        <Crown className="size-3" /> Owner
                      </Chip>
                    )}
                  </div>
                ))}
        </Card>

        {groups.length > 1 && (
          <>
            <SectionTitle>Switch group</SectionTitle>
            <Card className="animate-rise divide-y divide-line" style={rise(2)}>
              {groups.map((g) => (
                <button key={g.id} type="button" onClick={() => selectGroup(g.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <span className={cx('grid size-6 place-items-center rounded-full ring-2 transition', g.id === group.id ? 'bg-brand ring-brand' : 'ring-surface-3')}>
                    {g.id === group.id && <Check className="size-3.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className="flex-1 font-semibold">{g.name}</span>
                  <span className="font-mono text-xs text-muted">{g.invite_code}</span>
                </button>
              ))}
            </Card>
          </>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" icon={Plus} onClick={() => setSheet('create')}>
            New group
          </Button>
          <Button variant="secondary" icon={Hash} onClick={() => setSheet('join')}>
            Join group
          </Button>
        </div>
        <Button variant="danger" icon={LogOut} onClick={leave} className="mt-3 w-full">
          Leave {group.name}
        </Button>
      </div>

      <Sheet open={sheet != null} onClose={() => (setSheet(null), setError(null))} title={sheet === 'create' ? 'New group' : 'Join a group'}>
        <form onSubmit={submit}>
          {sheet === 'create' ? (
            <Field label="Group name" required maxLength={40} value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Early Birds" />
          ) : (
            <Field
              label="Invite code"
              icon={Hash}
              required
              maxLength={6}
              value={value}
              onChange={(e) => setValue(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="[&_input]:font-semibold [&_input]:tracking-[0.3em]"
            />
          )}
          {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
          <Button type="submit" loading={busy} disabled={sheet === 'create' ? !value.trim() : value.length < 6} className="mt-5 w-full">
            {sheet === 'create' ? 'Create group' : 'Join group'}
          </Button>
        </form>
      </Sheet>
    </div>
  )
}
