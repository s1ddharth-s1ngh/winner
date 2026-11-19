import { Star, X, type LucideIcon } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/** Staggered entrance: use with the `animate-rise` class. */
export const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 55}ms` })

export function Card({ className, children, onClick, style }: { className?: string; children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  const cls = cx('surface-card rounded-[26px]', className)
  return onClick ? (
    <button type="button" onClick={onClick} style={style} className={cx(cls, 'block w-full text-left transition active:scale-[0.985]')}>
      {children}
    </button>
  ) : (
    <div className={cls} style={style}>
      {children}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-[color-mix(in_oklab,var(--brand)_88%,black)]',
  secondary: 'bg-surface-2 text-ink ring-1 ring-line hover:bg-surface-3',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'bg-danger text-white hover:bg-[color-mix(in_oklab,var(--danger)_88%,black)]',
}

/** Every button is a pill (same rule as Telebi's NexSuite). */
export function Button({
  variant = 'primary',
  icon: Icon,
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      {loading ? (
        <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        Icon && <Icon className="size-[18px]" strokeWidth={2.2} />
      )}
      {children}
    </button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  badge,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; badge?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'relative grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-3 hover:text-ink',
        className,
      )}
    >
      <Icon className="size-[19px]" strokeWidth={2} />
      {badge && (
        <span className="absolute top-1.5 right-1.5 flex size-2.5">
          <span className="relative size-2.5 rounded-full bg-danger ring-2 ring-surface" />
        </span>
      )}
    </button>
  )
}

/** Pill tabs with a sliding indicator. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="tablist" className={cx('relative flex rounded-full bg-surface-2 p-1 ring-1 ring-line/60', className)}>
      <span
        aria-hidden
        className="surface-card absolute top-1 bottom-1 left-1 rounded-full transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${i * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-10 text-sm',
            o.value === value ? 'text-ink' : 'text-muted hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, color, src, size = 40, ring }: { name: string; color: string; src?: string | null; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-bold text-white', ring && 'ring-[3px] ring-bg')}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: color,
      }}
      aria-hidden
    >
      {src ? <img src={src} alt="" className="size-full rounded-full object-cover" /> : initials || '?'}
    </span>
  )
}

/** Row of stars: `value` filled out of `max`. */
export function Stars({ value, max, size = 14, className }: { value: number; max: number; size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size, animationDelay: `${i * 70}ms` }}
          className={i < value ? 'animate-pop fill-star text-star' : 'fill-surface-3 text-surface-3'}
          strokeWidth={1.5}
        />
      ))}
    </span>
  )
}

/** Compact "3★" chip. */
export function StarCount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 font-semibold tabular', className)}>
      {value}
      <Star className="size-[0.9em] fill-star text-star" strokeWidth={1.5} />
    </span>
  )
}

// Metal colors look the same in both themes on purpose.
const MEDAL: Record<number, string> = {
  1: 'bg-[#f5b731] text-[#5c3400]',
  2: 'bg-[#c5cedb] text-[#2f3a4c]',
  3: 'bg-[#d9925a] text-[#4a2507]',
}

/** Rank number, shown as a medal for the top 3. */
export function RankBadge({ rank, size = 24 }: { rank: number | null; size?: number }) {
  return rank && MEDAL[rank] ? (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-extrabold', MEDAL[rank])}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      {rank}
    </span>
  ) : (
    <span className={cx('shrink-0 text-center text-sm font-bold tabular', rank ? 'text-muted' : 'text-faint')} style={{ width: size }}>
      {rank ?? '–'}
    </span>
  )
}

export type Tone ='muted' | 'steps' | 'stairs' | 'sleep' | 'star' | 'hobby' | 'brand' | 'danger'

export function Chip({ children, tone = 'muted', className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const tones: Record<Tone, string> = {
    muted: 'bg-surface-2 text-muted',
    steps: 'bg-steps-soft text-steps-strong',
    stairs: 'bg-stairs-soft text-stairs-strong',
    sleep: 'bg-sleep-soft text-sleep-strong',
    star: 'bg-star-soft text-star-strong',
    hobby: 'bg-hobby-soft text-hobby-strong',
    brand: 'bg-brand-soft text-brand',
    danger: 'bg-danger-soft text-danger',
  }
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', tones[tone], className)}>
      {children}
    </span>
  )
}

export function Field({
  label,
  hint,
  icon: Icon,
  trailing,
  className,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; icon?: LucideIcon; trailing?: ReactNode }) {
  const id = useId()
  return (
    <div className={cx('block', className)}>
      <label htmlFor={id} className="mb-1.5 block px-1 text-[13px] font-semibold text-ink-2">
        {label}
      </label>
      <span className="flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-4 ring-1 ring-line/60 transition focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand">
        {Icon && <Icon className="size-[18px] shrink-0 text-faint" />}
        <input id={id} {...input} className="h-full w-full min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint" />
        {trailing}
      </span>
      {hint && <span className="mt-1.5 block px-1 text-xs text-muted">{hint}</span>}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex items-center justify-between gap-3 px-1">
      <h2 className="truncate text-[17px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="safe-top flex items-end justify-between gap-3 px-5 pb-5">
      <div className="min-w-0 pt-3">
        {subtitle && <div className="mb-1 text-[12px] font-semibold tracking-[0.04em] text-faint uppercase">{subtitle}</div>}
        <h1 className="truncate text-[28px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
    </header>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-shimmer rounded-[26px] bg-[linear-gradient(90deg,var(--surface-2)_0%,var(--surface-3)_50%,var(--surface-2)_100%)] bg-[length:200%_100%]',
        className,
      )}
    />
  )
}

/** Number that counts up to its value when it changes. */
export function AnimatedNumber({ value, format = (n) => String(Math.round(n)), duration = 900 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = ms ? Math.min(1, (t - start) / ms) : 1
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3))
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value, duration])
  return <>{format(shown)}</>
}

/** Bottom sheet modal. Closes on backdrop tap and Escape. Slides out before unmounting. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const closing = mounted && !open

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <div
      className={cx('fixed inset-0 z-50 flex items-end justify-center', closing && 'pointer-events-none')}
      role="dialog"
      aria-modal
      aria-label={title}
      aria-hidden={closing || undefined}
    >
      <div className={cx('absolute inset-0 bg-scrim backdrop-blur-[3px]', closing ? 'animate-fade-out' : 'animate-fade-in')} onClick={onClose} />
      <div
        // Children run their own animations; only the panel's own end should unmount.
        onAnimationEnd={(e) => closing && e.target === e.currentTarget && setMounted(false)}
        className={cx(
          'safe-bottom no-scrollbar relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[32px] bg-bg ring-1 ring-line will-change-transform',
          closing ? 'animate-sheet-out' : 'animate-sheet-in',
        )}
      >
        <div className="sticky top-0 z-10 bg-bg/90 px-5 pt-3 pb-3 backdrop-blur-xl">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-surface-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <IconButton
              icon={X}
              label="Close"
              onClick={onClose}
              // X tilts on hover, squeezes on press, spins away while the sheet exits.
              className={cx(
                'size-9 [&>svg]:transition-transform [&>svg]:duration-300 [&>svg]:ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:[&>svg]:rotate-90 active:[&>svg]:scale-75',
                closing && '[&>svg]:rotate-180 [&>svg]:scale-50',
              )}
            />
          </div>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
