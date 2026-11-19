import { Activity, BedDouble, ChartColumn, ChevronRight, Footprints, House, Plus, Trophy, UserRound } from 'lucide-react'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Sheet, cx } from '../components/ui'
import type { ISODate } from '../lib/dates'
import EntrySheet from '../screens/sheets/EntrySheet'
import WorkoutSheet from '../screens/sheets/WorkoutSheet'
import { useOvertakeWatcher } from './inbox'
import PendingInvite from './PendingInvite'
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
      <div className="mx-auto min-h-dvh max-w-md pb-28">
        <Outlet />
      </div>
      <PendingInvite />

      {/* Flat tab bar: hairline on top, outlined icons, the active tab in the accent color. */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[var(--nav-bg)]">
        <div className="mx-auto grid h-[62px] max-w-md grid-cols-5 items-center">
          {TABS.map((t) =>
            t ? (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) => cx('flex flex-col items-center gap-1 text-[11px] font-medium transition-colors', isActive ? 'text-brand' : 'text-faint hover:text-muted')}
              >
                <t.icon className="size-[22px]" strokeWidth={1.6} />
                {t.label}
              </NavLink>
            ) : (
              <div key="add" className="flex justify-center">
                <button
                  type="button"
                  aria-label="Add data"
                  onClick={() => setSheet({ kind: 'chooser' })}
                  className="group grid size-11 place-items-center rounded-full bg-brand text-white transition-[background-color,transform] duration-200 ease-out hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)] active:scale-90"
                >
                  {/* Same springy spin as the sheet's close X; turns into an × while a sheet is open. */}
                  <Plus
                    className={cx(
                      'size-6 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                      sheet ? 'rotate-[135deg]' : 'group-hover:rotate-90 group-active:scale-75',
                    )}
                    strokeWidth={2.2}
                  />
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
            tone="bg-steps"
          />
          <ChooserOption
            onClick={() => setSheet({ kind: 'workout' })}
            title="Workout or hobby"
            text="Gym, run, padel… with how long it took"
            icons={[<Activity key="d" className="size-5" />]}
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
    <button type="button" onClick={onClick} className="surface-card group flex animate-rise items-center gap-4 rounded-[26px] p-4 text-left transition-colors hover:bg-surface-2">
      <span className={cx('flex h-14 min-w-14 items-center justify-center gap-0.5 rounded-[18px] px-3 text-white', tone)}>{icons}</span>
      <span className="flex-1">
        <span className="block font-bold">{title}</span>
        <span className="block text-[13px] text-muted">{text}</span>
      </span>
      <ChevronRight className="size-5 text-faint transition group-hover:translate-x-0.5" />
    </button>
  )
}
