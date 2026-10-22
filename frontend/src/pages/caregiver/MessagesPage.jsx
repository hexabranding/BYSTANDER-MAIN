import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, MessageSquare, Phone, Send } from 'lucide-react'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
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
import {
  bookingService,
  messageService,
  isMongoObjectId,
  adaptMessage,
  initSocketConnection,
  joinBookingRoom,
  leaveBookingRoom,
  emitTyping,
  onNewMessage,
  onTyping,
  onMessagesRead,
} from '@/services'

export function MessagesPage() {
  useDocumentTitle('Messages')
  const { user } = useAuth()
  const { conversations: localConversations, sendMessage: localSendMessage, markConversationRead: localMarkRead } = useData()

  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(() => searchParams.get('thread'))
  const [showThread, setShowThread] = useState(() => Boolean(searchParams.get('thread')))
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [apiThreads, setApiThreads] = useState([])
  const [threadMessages, setThreadMessages] = useState({})
  const [unreadMap, setUnreadMap] = useState({})
  const [partnerTyping, setPartnerTyping] = useState(false)
  const threadRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // 1. Load caregiver booking threads and unread counts
  const loadCaregiverThreads = useCallback(async () => {
    if (!user) return
    try {
      const [bookingsRes, unreadRes] = await Promise.all([
        bookingService.getBookings({ limit: 50 }),
        messageService.getUnreadCounts().catch(() => ({ totalUnread: 0, unreadByBooking: [] })),
      ])

      const unreadMapping = {}
      if (Array.isArray(unreadRes.unreadByBooking)) {
        unreadRes.unreadByBooking.forEach((u) => {
          unreadMapping[String(u.bookingId)] = u.unreadCount
        })
      }
      setUnreadMap(unreadMapping)

      const realThreads = (bookingsRes.bookings || []).map((b) => {
        const canSend = b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'In Progress'

        // 1. Resolve authoritative customer name
        const rawCustName =
          b.customerName ||
          b.customer?.fullName ||
          b.customer?.name ||
          (typeof b.customer === 'object' && b.customer?.fullName) ||
          'Customer'
        const custName = rawCustName
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ')

        // 2. Resolve service and role labels
        const serviceTitle =
          b.serviceName ||
          (typeof b.service === 'string' ? b.service : b.service?.name) ||
          'Care Service'
        const roleLabel = '(Customer)'
        const role = `${roleLabel} · ${serviceTitle}`

        return {
          id: b.id,
          bookingId: b.id,
          bookingRef: b.ref,
          bookingStatus: b.status,
          audience: ['caregiver'],
          name: custName,
          roleLabel,
          serviceTitle,
          role,
          avatar: b.customer?.avatar || '',
          unread: unreadMapping[b.id] || 0,
          canSend,
          messages: [],
        }
      })

      if (realThreads.length > 0) {
        setApiThreads(realThreads)
      }
    } catch {
      // Fallback safely for demo mode
    }
  }, [user])

  useEffect(() => {
    loadCaregiverThreads()
  }, [loadCaregiverThreads])

  // Determine conversation list
  const caregiverConversations = useMemo(() => {
    if (apiThreads.length > 0) return apiThreads
    return (localConversations || []).filter((c) => c.audience?.includes('caregiver'))
  }, [apiThreads, localConversations])

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

  // Fetch messages and mark as read when thread is active
  useEffect(() => {
    if (!activeId) return
    let isMounted = true

    if (isMongoObjectId(activeId)) {
      messageService
        .getMessages(activeId, { limit: 50 }, user?._id || user?.id)
        .then((res) => {
          if (!isMounted) return
          setThreadMessages((prev) => ({
            ...prev,
            [activeId]: res.messages || [],
          }))
        })
        .catch(() => {})

      messageService
        .markMessagesAsRead(activeId)
        .then(() => {
          if (!isMounted) return
          setUnreadMap((prev) => ({ ...prev, [activeId]: 0 }))
          setApiThreads((prev) =>
            prev.map((t) => (t.id === activeId ? { ...t, unread: 0 } : t)),
          )
        })
        .catch(() => {})
    } else {
      if (active?.unread && typeof localMarkRead === 'function') {
        localMarkRead(active.id)
      }
    }

    return () => {
      isMounted = false
    }
  }, [activeId, user, active?.id, active?.unread, localMarkRead])

  // Socket room joining and event handling
  useEffect(() => {
    initSocketConnection()

    const unsubMsg = onNewMessage((rawMsg) => {
      const adapted = adaptMessage(rawMsg, user?._id || user?.id)
      const bId = adapted.bookingId

      setThreadMessages((prev) => {
        const existing = prev[bId] || []
        if (existing.some((m) => (m._id || m.id) === (adapted._id || adapted.id))) {
          return prev
        }
        return {
          ...prev,
          [bId]: [...existing, adapted],
        }
      })

      if (bId === activeId && adapted.from !== 'me') {
        messageService.markMessagesAsRead(bId).catch(() => {})
      } else if (bId !== activeId) {
        setUnreadMap((prev) => ({
          ...prev,
          [bId]: (prev[bId] || 0) + 1,
        }))
      }
    })

    const unsubTyping = onTyping((data) => {
      if (data.bookingId === activeId && String(data.userId) !== String(user?._id || user?.id)) {
        setPartnerTyping(Boolean(data.isTyping))
      }
    })

    const unsubRead = onMessagesRead((data) => {
      if (data.bookingId === activeId) {
        setThreadMessages((prev) => {
          const msgs = prev[activeId] || []
          return {
            ...prev,
            [activeId]: msgs.map((m) => ({ ...m, read: true })),
          }
        })
      }
    })

    return () => {
      unsubMsg()
      unsubTyping()
      unsubRead()
    }
  }, [user, activeId])

  useEffect(() => {
    if (activeId && isMongoObjectId(activeId)) {
      joinBookingRoom(activeId)
    }
    setPartnerTyping(false)
    return () => {
      if (activeId && isMongoObjectId(activeId)) {
        leaveBookingRoom(activeId)
      }
    }
  }, [activeId])

  const activeMessages = useMemo(() => {
    if (!active) return []
    return threadMessages[active.id] || active.messages || []
  }, [active, threadMessages])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeId, activeMessages.length])

  const openConversation = (id) => {
    setActiveId(id)
    setShowThread(true)
  }

  const handleDraftChange = (e) => {
    const val = e.target.value
    setDraft(val)

    if (active && isMongoObjectId(active.id)) {
      emitTyping(active.id, true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        emitTyping(active.id, false)
      }, 1500)
    }
  }

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || !active) return

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (active && isMongoObjectId(active.id)) {
      emitTyping(active.id, false)
    }

    if (active.canSend === false) {
      toast.error(
        `Cannot send messages for a booking in '${active.bookingStatus || 'closed'}' status. Messaging is only permitted during pending, confirmed, or in-progress care engagements.`,
      )
      return
    }

    setSending(true)
    try {
      if (isMongoObjectId(active.id)) {
        const createdMsg = await messageService.sendMessage(active.id, text, user?._id || user?.id)
        setThreadMessages((prev) => {
          const current = prev[active.id] || []
          if (current.some((m) => (m._id || m.id) === (createdMsg._id || createdMsg.id))) {
            return prev
          }
          return {
            ...prev,
            [active.id]: [...current, createdMsg],
          }
        })
        setDraft('')

        if (createdMsg.isFlagged) {
          toast.info('Message sent. Note: contact details/phone patterns are flagged for platform review.')
        }
      } else {
        if (typeof localSendMessage === 'function') {
          localSendMessage(active.id, text)
        }
        setDraft('')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messages"
        subtitle="Chat with customers and CareMate operations about your shifts."
        meta={
          <span className="text-sm text-muted">
            {caregiverConversations.length} conversation{caregiverConversations.length === 1 ? '' : 's'}
          </span>
        }
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
                  const msgs = threadMessages[c.id] || c.messages || []
                  const last = msgs[msgs.length - 1]
                  const isActive = c.id === activeId
                  const unreadCount = unreadMap[c.id] ?? c.unread ?? 0

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
                          <span className="shrink-0 text-[11px] text-faint">
                            {last ? relativeTime(last.at) : ''}
                          </span>
                        </div>
                        <p className="truncate text-xs text-muted">
                          {c.roleLabel ? (
                            <>
                              <span className="font-semibold text-primary-700">{c.roleLabel}</span>
                              {c.serviceTitle ? ` · ${c.serviceTitle}` : ''}
                            </>
                          ) : (
                            c.role
                          )}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs text-faint">{last?.text || 'No messages yet'}</p>
                          {unreadCount ? (
                            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary-700 px-1.5 text-[10px] font-bold text-white">
                              {unreadCount}
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
                      <p className="truncate text-xs text-muted">
                        {active.roleLabel ? (
                          <>
                            <span className="font-semibold text-primary-700">{active.roleLabel}</span>
                            {active.serviceTitle ? ` · ${active.serviceTitle}` : ''}
                            {active.bookingStatus ? ` · ${active.bookingStatus}` : ''}
                          </>
                        ) : (
                          active.role
                        )}
                      </p>
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
                    onClick={() => toast.info('Direct calling is not integrated. Please coordinate via secure in-app chat.')}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>

                {active.canSend === false ? (
                  <div className="flex items-center gap-2 border-b border-warning-200 bg-warning-50 px-4 py-2 text-xs text-warning-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" />
                    <span>
                      This booking is {active.bookingStatus?.toLowerCase() || 'closed'}. Messaging is in read-only mode.
                    </span>
                  </div>
                ) : null}

                <div ref={threadRef} className="thin-scrollbar flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-5 sm:px-5">
                  {activeMessages.length ? (
                    activeMessages.map((m) => (
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
                    ))
                  ) : (
                    <div className="grid h-full place-items-center text-center">
                      <p className="text-sm text-muted">No messages in this conversation yet. Send the first message below.</p>
                    </div>
                  )}
                </div>

                {partnerTyping ? (
                  <div className="flex items-center gap-2 border-t border-line bg-mint-50/70 px-4 py-1.5 text-xs font-medium text-primary-700 sm:px-5">
                    <span className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-600" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-600 delay-150" />
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-600 delay-300" />
                    </span>
                    <span>{active.name.split(' ')[0]} is typing…</span>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
                  <input
                    type="text"
                    value={draft}
                    onChange={handleDraftChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={
                      active.canSend === false
                        ? 'Messaging is closed for this booking'
                        : 'Type a message…'
                    }
                    aria-label="Message"
                    disabled={active.canSend === false || sending}
                    className="h-11 flex-1 rounded-xl border border-line-strong bg-white px-3.5 text-sm text-ink placeholder:text-faint transition focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100 disabled:bg-slate-50 disabled:cursor-not-allowed"
                  />
                  <Button variant="primary" icon={Send} disabled={!draft.trim() || active.canSend === false || sending} loading={sending} onClick={handleSend}>
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
