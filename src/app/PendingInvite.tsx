import { useState } from 'react'
import { Button, Sheet } from '../components/ui'
import { useToast } from '../components/toast'
import { repo } from '../data/repo'
import { clearPendingJoin, pendingJoin } from '../lib/invite'
import { useSession } from './session'

/** Asks a signed-in user (already in a group) to join the group from an invite link. */
export default function PendingInvite() {
  const { groups, selectGroup } = useSession()
  const toast = useToast()
  const [code, setCode] = useState(() => {
    const c = pendingJoin()
    // Already a member: nothing to ask.
    if (c && groups.some((g) => g.invite_code === c)) clearPendingJoin()
    return pendingJoin()
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    clearPendingJoin()
    setCode(null)
  }
  const join = async () => {
    if (!code) return
    setBusy(true)
    setError(null)
    try {
      const g = await repo.joinGroup(code)
      close()
      selectGroup(g.id)
      toast(`Joined ${g.name}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={code != null} onClose={close} title="Group invite">
      <p className="text-[15px] text-muted">
        You opened an invite link for the group with code <span className="font-mono font-bold tracking-widest text-ink">{code}</span>.
      </p>
      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={close}>
          Not now
        </Button>
        <Button loading={busy} onClick={join}>
          Join group
        </Button>
      </div>
    </Sheet>
  )
}
