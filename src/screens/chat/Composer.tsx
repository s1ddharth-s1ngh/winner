import { SendHorizontal } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Avatar } from '../../components/ui'
import { useToast } from '../../components/toast'
import { toTagged } from '../../domain/chat'
import type { Profile } from '../../domain/types'

// "@" + what has been typed after it, right before the caret.
const MENTION_QUERY = /(?:^|\s)@([^\s@]{0,20})$/

/**
 * Message box. Typing "@" suggests the chat members; picking one writes "@name" and remembers the id,
 * turned into a tag on send. Mount with a new `key` to start over (e.g. to edit another message).
 */
export default function Composer({
  people,
  initial,
  banner,
  onSend,
}: {
  people: Profile[]
  initial?: { text: string; picked: Map<string, string> }
  banner?: ReactNode
  onSend(body: string, mentions: string[]): Promise<void>
}) {
  const toast = useToast()
  const [text, setText] = useState(initial?.text ?? '')
  const [query, setQuery] = useState<string | null>(null)
  const picked = useRef(new Map(initial?.picked))
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow with the text, up to about six lines.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`
  }, [text])

  const matches = query === null ? [] : people.filter((p) => p.username.toLowerCase().includes(query.toLowerCase())).slice(0, 5)

  const pick = (p: Profile) => {
    const el = ref.current
    if (!el) return
    const before = text.slice(0, el.selectionStart).replace(/@([^\s@]{0,20})$/, `@${p.username} `)
    picked.current.set(p.username, p.id)
    setText(before + text.slice(el.selectionStart))
    setQuery(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(before.length, before.length)
    })
  }

  const submit = async () => {
    const draft = text
    const { body, mentions } = toTagged(text, picked.current)
    if (!body) return
    setText('')
    setQuery(null)
    try {
      await onSend(body, mentions)
    } catch (e) {
      setText(draft)
      toast((e as Error).message, 'error')
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (matches.length && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault()
      pick(matches[0])
    } else if (e.key === 'Escape') {
      setQuery(null)
      // On phones Enter adds a line; the send button sends.
    } else if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="safe-bottom border-t border-line bg-bg/90 px-3 pt-2 backdrop-blur-xl">
      {banner}
      {matches.length > 0 && (
        <div className="mb-2 overflow-hidden rounded-[20px] bg-surface ring-1 ring-line" role="listbox" aria-label="Mention someone">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={false}
              // Keep the focus (and the caret) in the text box.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-[15px] transition-colors hover:bg-surface-2"
            >
              <Avatar name={p.username} color={p.avatar_color} src={p.avatar_url} size={28} />
              {p.username}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 pb-2">
        <textarea
          ref={ref}
          rows={1}
          maxLength={4000}
          value={text}
          placeholder="Message"
          aria-label="Message"
          onChange={(e) => {
            setText(e.target.value)
            setQuery(e.target.value.slice(0, e.target.selectionStart).match(MENTION_QUERY)?.[1] ?? null)
          }}
          onKeyDown={onKeyDown}
          className="no-scrollbar min-h-11 flex-1 resize-none rounded-[22px] bg-surface-2 px-4 py-2.5 text-[15px] text-ink ring-1 ring-line outline-none placeholder:text-faint focus:ring-2 focus:ring-brand"
        />
        <button
          type="button"
          aria-label="Send"
          disabled={!text.trim()}
          onClick={() => void submit()}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-white transition-[opacity,transform] active:scale-90 disabled:opacity-40"
        >
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </div>
  )
}
