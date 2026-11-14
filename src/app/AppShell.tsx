import { BedDouble, ChartColumn, Dumbbell, Footprints, House, Plus, Trophy, UserRound } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Sheet, cx } from '../components/ui'
import type { ISODate } from '../lib/dates'
import EntrySheet from '../screens/sheets/EntrySheet'
import WorkoutSheet from '../screens/sheets/WorkoutSheet'
import { useOvertakeWatcher } from './inbox'
import { useSession } from './session'
import { useHealthAutoSync } from '../native/health'

type SheetState = null | { kind: 'chooser' } | { kind: 'entry'; date?: ISODate } | { kind: 'workout' }

const Ctx = createContext<{ openEntry(date?: ISODate): void; openWorkout(): void }>({ openEntry() {}, openWorkout() {} })
export const useSheets = () => useContext(Ctx)

const TABS = [
  { to: '/', label: 'Today', icon: House },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
  null,
  { to: '/stats', label: 'Stats', icon: ChartColumn },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export default function AppShell() {
  const [sheet, setSheet] = useState<SheetState>(null)
  const close = useCallback(() => setSheet(null), [])
  const { user, profile } = useSession()
  useOvertakeWatcher()
  useHealthAutoSync(user.id, profile.timezone)

  return (
    <Ctx.Provider value={{ openEntry: (date) => setSheet({ kind: 'entry', date }), openWorkout: () => setSheet({ kind: 'workout' }) }}>
      {/* Scrim behind the status bar on edge-to-edge devices (height is 0 elsewhere). */}
      <div className="fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-bg/85 backdrop-blur-md" />
      <div className="mx-auto min-h-dvh max-w-md pb-32">
        <Outlet />
      </div>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line/70 bg-surface/90 backdrop-blur-xl">
        <div className="grid h-16 grid-cols-5 items-center">
          {TABS.map((t) =>
            t ? (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => cx('flex flex-col items-center gap-1 text-[11px] font-semibold transition', isActive ? 'text-brand' : 'text-faint hover:text-muted')}
              >
                {({ isActive }) => (
                  <>
                    <t.icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                    {t.label}
                  </>
                )}
              </NavLink>
            ) : (
              <div key="add" className="flex justify-center">
                <button
                  type="button"
                  aria-label="Add data"
                  onClick={() => setSheet({ kind: 'chooser' })}
                  className="-mt-7 grid size-14 place-items-center rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-2))] text-white shadow-[var(--shadow-float)] ring-4 ring-bg transition active:scale-90"
                >
                  <Plus className="size-7" strokeWidth={2.6} />
                </button>
              </div>
            ),
          )}
        </div>
      </nav>

      <Sheet open={sheet?.kind === 'chooser'} onClose={close} title="Add">
        <div className="grid gap-3">
          <ChooserOption
            onClick={() => setSheet({ kind: 'entry' })}
            title="Steps & sleep"
            text="Log today's steps or last night's sleep"
            icons={[
              <Footprints key="f" className="size-5" />,
              <BedDouble key="b" className="size-5" />,
            ]}
            tone="bg-[linear-gradient(135deg,var(--steps),var(--sleep))]"
          />
          <ChooserOption
            onClick={() => setSheet({ kind: 'workout' })}
            title="Workout or hobby"
            text="Gym, run, padel… with how long it took"
            icons={[<Dumbbell key="d" className="size-5" />]}
            tone="bg-hobby"
          />
        </div>
      </Sheet>
      <EntrySheet open={sheet?.kind === 'entry'} onClose={close} initialDate={sheet?.kind === 'entry' ? sheet.date : undefined} />
      <WorkoutSheet open={sheet?.kind === 'workout'} onClose={close} />
    </Ctx.Provider>
  )
}

function ChooserOption({ onClick, title, text, icons, tone }: { onClick: () => void; title: string; text: string; icons: ReactNode[]; tone: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-3xl bg-surface p-4 text-left ring-1 ring-line/70 transition active:scale-[0.98]">
      <span className={cx('flex h-14 min-w-14 items-center justify-center gap-0.5 rounded-2xl px-3 text-white', tone)}>{icons}</span>
      <span>
        <span className="block font-bold">{title}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
    </button>
  )
}
