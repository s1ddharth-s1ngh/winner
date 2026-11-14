import { Star, X, type LucideIcon } from 'lucide-react'
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  const cls = cx('rounded-3xl bg-surface shadow-[var(--shadow-card)] ring-1 ring-line/60', className)
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, 'block w-full text-left transition active:scale-[0.99]')}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-[var(--shadow-float)] hover:brightness-110 disabled:shadow-none',
  secondary: 'bg-surface text-ink ring-1 ring-line hover:bg-surface-2',
  ghost: 'text-brand hover:bg-brand-soft',
  danger: 'bg-danger-soft text-danger hover:brightness-95',
}

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
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-50',
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
        'relative grid size-10 place-items-center rounded-full bg-surface text-ink-2 ring-1 ring-line transition hover:bg-surface-2 active:scale-95',
        className,
      )}
    >
      <Icon className="size-[19px]" strokeWidth={2} />
      {badge && <span className="absolute top-2 right-2 size-2.5 rounded-full bg-danger ring-2 ring-surface" />}
    </button>
  )
}

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
  return (
    <div role="tablist" className={cx('flex rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-xl font-semibold transition',
            size === 'sm' ? 'h-8 text-[13px]' : 'h-10 text-sm',
            o.value === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Avatar({ name, color, size = 40, ring }: { name: string; color: string; size?: number; ring?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-white', ring && 'ring-3 ring-surface')}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 70%, black))`,
      }}
      aria-hidden
    >
      {initials || '?'}
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
          style={{ width: size, height: size }}
          className={i < value ? 'fill-star text-star' : 'fill-line text-line'}
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

export function Chip({ children, tone = 'muted', className }: { children: ReactNode; tone?: 'muted' | 'steps' | 'sleep' | 'star' | 'hobby' | 'brand' | 'danger'; className?: string }) {
  const tones = {
    muted: 'bg-surface-2 text-muted',
    steps: 'bg-steps-soft text-steps-strong',
    sleep: 'bg-sleep-soft text-sleep-strong',
    star: 'bg-star-soft text-[#a15c00]',
    hobby: 'bg-hobby-soft text-[#b4500b]',
    brand: 'bg-brand-soft text-brand',
    danger: 'bg-danger-soft text-danger',
  }
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', tones[tone], className)}>
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
    <label htmlFor={id} className={cx('block', className)}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="flex h-12 items-center gap-2.5 rounded-2xl bg-surface-2 px-3.5 ring-1 ring-transparent transition focus-within:bg-surface focus-within:ring-brand">
        {Icon && <Icon className="size-[18px] shrink-0 text-faint" />}
        <input id={id} {...input} className="h-full w-full min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint" />
        {trailing}
      </span>
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-7 mb-3 flex items-center justify-between px-1">
      <h2 className="text-[17px] font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="safe-top flex items-end justify-between gap-3 px-5 pb-4">
      <div className="min-w-0 pt-3">
        {subtitle && <p className="text-[13px] font-medium text-muted">{subtitle}</p>}
        <h1 className="truncate text-[28px] font-bold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pb-1">{actions}</div>}
    </header>
  )
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="size-7" />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-line/60', className)} />
}

/** Bottom sheet modal. Closes on backdrop tap and Escape. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
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

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="safe-bottom relative max-h-[92dvh] w-full max-w-md animate-sheet-in overflow-y-auto rounded-t-[28px] bg-bg">
        <div className="sticky top-0 z-10 bg-bg/95 px-5 pt-3 pb-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            <IconButton icon={X} label="Close" onClick={onClose} className="size-9" />
          </div>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
