import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, SearchX, Send } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { formatDate, formatTime, relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/Tabs'
import { EmptyState } from '@/components/common/States'
import { Input } from '@/components/forms/FormField'

const lastOf = (c) => c.messages[c.messages.length - 1]

export function MessagesPage() {
  useDocumentTitle('Messages')
  const { conversations, sendMessage, markConversationRead } = useData()

  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeId, setActiveId] = useState(() => searchParams.get('thread'))
  const [draft, setDraft] = useState('')
  const [mobilePane, setMobilePane] = useState(() => (searchParams.get('thread') ? 'chat' : 'list'))
  const debouncedSearch = useDebouncedValue(search)
  const threadRef = useRef(null)

  const mine = useMemo(() => conversations.filter((c) => c.audience?.includes('customer')), [conversations])

  const sorted = useMemo(
    () => [...mine].sort((a, b) => new Date(lastOf(b)?.at || 0) - new Date(lastOf(a)?.at || 0)),
    [mine],
  )

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((c) => {
      const last = lastOf(c)
      return (
        c.name.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.bookingRef?.toLowerCase().includes(q) ||
        last?.text?.toLowerCase().includes(q)
      )
    })
  }, [sorted, debouncedSearch])

  const active = useMemo(() => mine.find((c) => c.id === activeId) || null, [mine, activeId])

  useEffect(() => {
    if (!sorted.length) return
    if (!activeId || !mine.some((c) => c.id === activeId)) {
      setActiveId(sorted[0].id)
      if (searchParams.get('thread')) setSearchParams({}, { replace: true })
    }
  }, [sorted, mine, activeId, searchParams, setSearchParams])

  const messageCount = active?.messages?.length || 0
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeId, messageCount])

  const groups = useMemo(() => {
    if (!active) return []
    const out = []
    active.messages.forEach((m) => {
      const key = String(m.at).slice(0, 10)
      const bucket = out[out.length - 1]
      if (bucket && bucket.key === key) bucket.items.push(m)
      else out.push({ key, items: [m] })
    })
    return out
  }, [active])

  const selectConversation = (c) => {
    setActiveId(c.id)
    setDraft('')
    setMobilePane('thread')
    markConversationRead(c.id)
  }

  const handleSend = (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !active) return
    sendMessage(active.id, text)
    setDraft('')
  }

  const today = new Date().toISOString().slice(0, 10)

  if (!mine.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" subtitle="Chat with your caregivers and the CareMate support desk." />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Once a caregiver is assigned to your booking, your chats will appear here."
            action={
              <Button to="/customer/book-caregiver" icon={MessageSquare}>
                Book a caregiver
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Chat with your caregivers and the CareMate support desk."
        meta={filtered.length ? <Chip>{`${filtered.length} conversations`}</Chip> : null}
      />

      <div className="flex h-[min(74vh,46rem)] min-h-[26rem] overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div
          className={cn(
            'w-full flex-col border-r border-line md:w-80 md:shrink-0',
            mobilePane === 'thread' ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="border-b border-line px-4 py-3">
            <SearchBar value={search} onChange={setSearch} placeholder="Search conversations…" size="sm" />
          </div>

          {filtered.length ? (
            <div className="thin-scrollbar flex-1 overflow-y-auto">
              {filtered.map((c) => {
                const last = lastOf(c)
                const isActive = c.id === activeId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectConversation(c)}
                    className={cn(
                      'flex w-full items-start gap-3 border-b border-line px-4 py-3.5 text-left transition',
                      isActive ? 'bg-mint-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <Avatar src={c.avatar} name={c.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-bold text-ink">{c.name}</span>
                        <span className="shrink-0 text-[11px] text-faint">{relativeTime(last?.at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted">{c.role}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-xs',
                            c.unread > 0 ? 'font-semibold text-ink' : 'text-faint',
                          )}
                        >
                          {last?.from === 'me' ? 'You: ' : ''}
                          {last?.text}
                        </span>
                        {c.unread > 0 ? (
                          <span className="shrink-0 rounded-full bg-primary-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {c.unread}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
              title="No matches"
              description="Try a different name, role or keyword."
              className="py-10"
            />
          )}
        </div>

        <div
          className={cn(
            'min-w-0 flex-1 flex-col',
            mobilePane === 'list' ? 'hidden md:flex' : 'flex',
          )}
        >
          {active ? (
            <>
              <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button
                  type="button"
                  onClick={() => setMobilePane('list')}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Avatar src={active.avatar} name={active.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-ink">{active.name}</p>
                  <p className="truncate text-xs text-muted">{active.role}</p>
                </div>
                {active.bookingRef ? <Chip className="shrink-0">{active.bookingRef}</Chip> : null}
              </div>

              <div ref={threadRef} className="thin-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-4 py-5">
                {groups.map((group) => (
                  <div key={group.key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="h-px flex-1 bg-line" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                        {group.key === today ? 'Today' : formatDate(group.items[0].at, { long: true })}
                      </span>
                      <span className="h-px flex-1 bg-line" />
                    </div>

                    {group.items.map((m) => {
                      const mineBubble = m.from === 'me'
                      return (
                        <div key={m.id} className={cn('flex flex-col', mineBubble ? 'items-end' : 'items-start')}>
                          <div
                            className={cn(
                              'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                              mineBubble
                                ? 'rounded-br-sm bg-primary-700 text-white'
                                : 'rounded-bl-sm border border-line bg-white text-ink',
                            )}
                          >
                            {m.text}
                          </div>
                          <span className="mt-1 px-1 text-[11px] text-faint">{formatTime(m.at)}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>

              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-line bg-white px-4 py-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Message ${active.name.split(' ')[0]}…`}
                  aria-label="Message text"
                  className="flex-1"
                />
                <Button type="submit" icon={Send} disabled={!draft.trim()}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Pick a caregiver or support thread from the list to start reading."
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default MessagesPage
