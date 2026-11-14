import { BedDouble, ChartColumn, ChevronRight, Dumbbell, Footprints, House, Plus, Trophy, UserRound } from 'lucide-react'
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
      <div className="fixed inset-x-0 top-0 z-30 h-[env(safe-area-inset-top)] bg-bg/80 backdrop-blur-xl" />
      <div className="mx-auto min-h-dvh max-w-md pb-36">
        <Outlet />
      </div>

      {/* Floating glass tab bar. */}
      <nav className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4">
        <div className="pointer-events-auto mb-2 grid h-[68px] grid-cols-5 items-center rounded-full bg-[var(--nav-bg)] px-1 shadow-[0_18px_40px_-14px_rgb(0_0_0/0.35),inset_0_1px_0_var(--card-highlight),0_0_0_1px_var(--card-ring)] backdrop-blur-2xl backdrop-saturate-150">
          {TABS.map((t) =>
            t ? (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => cx('group flex flex-col items-center gap-0.5 text-[10.5px] font-semibold transition', isActive ? 'text-brand' : 'text-faint hover:text-muted')}
              >
                {({ isActive }) => (
                  <>
                    <span className={cx('grid h-8 w-12 place-items-center rounded-full transition-all duration-300', isActive && 'bg-brand-soft')}>
                      <t.icon className={cx('size-[21px] transition-transform', isActive && 'scale-110')} strokeWidth={isActive ? 2.4 : 2} />
                    </span>
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
                  className="relative -mt-9 grid size-[60px] place-items-center rounded-full bg-[linear-gradient(135deg,var(--brand),var(--brand-2))] text-white shadow-[var(--shadow-float)] ring-[5px] ring-bg transition active:scale-90"
                >
                  <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgb(255_255_255/0.35),transparent_55%)]" />
                  <Plus className="relative size-7" strokeWidth={2.6} />
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
    <button type="button" onClick={onClick} className="surface-card group flex animate-rise items-center gap-4 rounded-[26px] p-4 text-left transition active:scale-[0.98]">
      <span className={cx('flex h-14 min-w-14 items-center justify-center gap-0.5 rounded-[18px] px-3 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]', tone)}>{icons}</span>
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
      <ChevronRight className="size-5 text-faint transition group-hover:translate-x-0.5" />
    </button>
  )
}
