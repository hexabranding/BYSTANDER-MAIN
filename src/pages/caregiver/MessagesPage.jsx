import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, MessageSquare, Phone, Send } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useDocumentTitle } from '@/hooks/useUi'
import { cn } from '@/utils/cn'
import { formatTime, relativeTime } from '@/utils/format'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Avatar } from '@/components/common/Avatar'
import { Chip } from '@/components/common/Tabs'
import { EmptyState } from '@/components/common/States'

export function MessagesPage() {
  useDocumentTitle('Messages')

  const { conversations, sendMessage, markConversationRead } = useData()

  const caregiverConversations = useMemo(
    () => conversations.filter((c) => c.audience?.includes('caregiver')),
    [conversations],
  )

  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(() => searchParams.get('thread'))
  const [showThread, setShowThread] = useState(() => Boolean(searchParams.get('thread')))
  const [draft, setDraft] = useState('')
  const threadRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return caregiverConversations
    return caregiverConversations.filter((c) => c.name.toLowerCase().includes(q))
  }, [caregiverConversations, query])

  const active = caregiverConversations.find((c) => c.id === activeId) || null

  useEffect(() => {
    if (!caregiverConversations.length) return
    if (!activeId || !caregiverConversations.some((c) => c.id === activeId)) {
      setActiveId(caregiverConversations[0].id)
      if (searchParams.get('thread')) {
        setShowThread(false)
        setSearchParams({}, { replace: true })
      }
    }
  }, [caregiverConversations, activeId, searchParams, setSearchParams])

  useEffect(() => {
    if (active?.unread) markConversationRead(active.id)
  }, [active, markConversationRead])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeId, active?.messages?.length])

  const openConversation = (id) => {
    setActiveId(id)
    setShowThread(true)
  }

  const handleSend = () => {
    const text = draft.trim()
    if (!text || !active) return
    sendMessage(active.id, text)
    setDraft('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Chat with customers and CareMate operations about your shifts — responses land here in real time."
        meta={<span className="text-sm text-muted">{caregiverConversations.length} conversation{caregiverConversations.length === 1 ? '' : 's'}</span>}
      />

      {caregiverConversations.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Once you are assigned a booking, the customer thread appears here."
            action={
              <Button variant="primary" to="/caregiver/jobs">
                Browse jobs
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:h-[640px] lg:grid-cols-[340px_1fr]">
          <Card className={cn('overflow-hidden', showThread ? 'hidden lg:flex' : 'flex', 'flex-col')}>
            <div className="border-b border-line p-4">
              <SearchBar value={query} onChange={setQuery} placeholder="Search conversations…" size="sm" />
            </div>
            <div className="thin-scrollbar flex-1 overflow-y-auto">
              {filtered.length ? (
                filtered.map((c) => {
                  const last = c.messages[c.messages.length - 1]
                  const isActive = c.id === activeId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => openConversation(c.id)}
                      className={cn(
                        'flex w-full gap-3 border-b border-line px-4 py-3.5 text-left transition',
                        isActive ? 'bg-mint-50' : 'hover:bg-slate-50',
                      )}
                    >
                      <Avatar src={c.avatar} name={c.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                          <span className="shrink-0 text-[11px] text-faint">{last ? relativeTime(last.at) : ''}</span>
                        </div>
                        <p className="truncate text-xs text-muted">{c.role}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-faint">{last?.text}</p>
                          {c.unread ? (
                            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary-700 px-1.5 text-[10px] font-bold text-white">
                              {c.unread}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })
              ) : (
                <EmptyState icon={MessageSquare} title="No match" description="No conversation matches that name." />
              )}
            </div>
          </Card>

          <Card className={cn('overflow-hidden', showThread ? 'flex' : 'hidden lg:flex', 'flex-col')}>
            {active ? (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      aria-label="Back to conversations"
                      onClick={() => setShowThread(false)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Avatar src={active.avatar} name={active.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm font-bold text-ink">{active.name}</p>
                      <p className="truncate text-xs text-muted">{active.role}</p>
                    </div>
                    {active.bookingRef ? (
                      <Chip className="hidden sm:inline-flex" selected>
                        {active.bookingRef}
                      </Chip>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Call"
                    onClick={() => toast.info('Calling is simulated in this demo')}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>

                <div ref={threadRef} className="thin-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-5 sm:px-5">
                  {active.messages.map((m) => (
                    <div key={m.id} className={cn('flex', m.from === 'me' ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[85%] sm:max-w-[70%]', m.from === 'me' ? 'text-right' : 'text-left')}>
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                            m.from === 'me'
                              ? 'rounded-br-sm bg-primary-700 text-white'
                              : 'rounded-bl-sm border border-line bg-white text-ink-soft shadow-card',
                          )}
                        >
                          {m.text}
                        </div>
                        <p className="mt-1 px-1 text-[11px] text-faint">{formatTime(m.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="Type a message…"
                    aria-label="Message"
                    className="h-11 flex-1 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink placeholder:text-faint transition focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100"
                  />
                  <Button variant="primary" icon={Send} disabled={!draft.trim()} onClick={handleSend}>
                    Send
                  </Button>
                </div>
              </>
            ) : (
              <EmptyState icon={MessageSquare} title="Select a conversation" description="Pick a thread on the left to start reading and replying." />
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

export default MessagesPage
