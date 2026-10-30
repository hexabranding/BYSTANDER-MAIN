import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, SearchX, Send, AlertTriangle, ChevronDown, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useData } from '@/context/DataContext'
import { useAuth } from '@/context/AuthContext'
import { useDebouncedValue, useDocumentTitle } from '@/hooks/useUi'
import { formatDate, formatTime, relativeTime } from '@/utils/format'
import { cn } from '@/utils/cn'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchBar } from '@/components/common/SearchBar'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import { Chip } from '@/components/common/Tabs'
import { EmptyState } from '@/components/common/States'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { Input } from '@/components/forms/FormField'
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

const lastOf = (c) => (c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null)

export function MessagesPage() {
  useDocumentTitle('Messages')
  const { user } = useAuth()
  const { conversations: localConversations, sendMessage: localSendMessage, markConversationRead: localMarkRead } = useData()

  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeId, setActiveId] = useState(() => searchParams.get('thread'))
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [mobilePane, setMobilePane] = useState(() => (searchParams.get('thread') ? 'chat' : 'list'))
  const [apiThreads, setApiThreads] = useState([])
  const [threadMessages, setThreadMessages] = useState({})
  const [unreadMap, setUnreadMap] = useState({})
  const [partnerTyping, setPartnerTyping] = useState(false)

  const currentUserId = String(user?._id || user?.id || 'guest')
  const storageKey = `bystander.deleted_chats_${currentUserId}`

  const [deletedChatIds, setDeletedChatIds] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      setDeletedChatIds(saved ? JSON.parse(saved) : [])
    } catch {
      setDeletedChatIds([])
    }
  }, [storageKey])

  const [menuOpenId, setMenuOpenId] = useState(null)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-chat-menu]')) {
        setMenuOpenId(null)
        setHeaderMenuOpen(false)
      }
    }
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  const debouncedSearch = useDebouncedValue(search)
  const threadRef = useRef(null)
  const typingTimeoutRef = useRef(null)

  // 1. Fetch real bookings and unread counts for customer
  const loadCustomerThreads = useCallback(async () => {
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

      // Only include bookings where a caregiver is assigned / connected
      const connectedBookings = (bookingsRes.bookings || []).filter((b) => {
        const hasCaregiver = Boolean(
          b.caregiverUser || (b.caregiver && b.caregiver !== 'unassigned')
        )
        return hasCaregiver && b.status !== 'Cancelled'
      })

      const realThreads = connectedBookings.map((b) => {
        const canSend = b.status === 'Pending' || b.status === 'Confirmed' || b.status === 'In Progress'

        // 1. Resolve authoritative caregiver name
        const rawCaregiverName =
          b.caregiverName ||
          b.caregiver?.user?.fullName ||
          b.caregiver?.fullName ||
          b.caregiverUser?.fullName ||
          (typeof b.caregiver === 'object' && b.caregiver?.name) ||
          'Caregiver'
        const caregiverName = rawCaregiverName
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ')

        // 2. Resolve service and role labels
        const serviceTitle =
          b.serviceName ||
          (typeof b.service === 'string' ? b.service : b.service?.name) ||
          'Care Service'
        const roleLabel = '(Caregiver)'
        const role = `${roleLabel} · ${serviceTitle}`

        return {
          id: b.id,
          bookingId: b.id,
          bookingRef: b.ref,
          bookingStatus: b.status,
          audience: ['customer'],
          name: caregiverName,
          roleLabel,
          serviceTitle,
          role,
          avatar: b.caregiver?.avatar || b.caregiver?.user?.avatar || b.caregiverUser?.avatar || '',
          unread: unreadMapping[b.id] || 0,
          canSend,
          messages: [],
        }
      })

      setApiThreads(realThreads)
    } catch {
      setApiThreads([])
    }
  }, [user])

  useEffect(() => {
    loadCustomerThreads()
  }, [loadCustomerThreads])

  // Determine active conversation list: authenticated user uses apiThreads directly
  const mine = useMemo(() => {
    const base = user ? apiThreads : (localConversations || []).filter((c) => c.audience?.includes('customer'))
    return base.filter((c) => !deletedChatIds.includes(String(c.id)))
  }, [user, apiThreads, localConversations, deletedChatIds])

  const handleDeleteChat = useCallback((thread) => {
    if (!thread?.id) return
    const idStr = String(thread.id)

    setDeletedChatIds((prev) => {
      const next = Array.from(new Set([...prev, idStr]))
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch (e) {
        console.error('Failed to save deleted chat:', e)
      }
      return next
    })

    setDeleteDialog(null)
    setMenuOpenId(null)
    setHeaderMenuOpen(false)

    if (activeId === idStr) {
      const remaining = mine.filter((c) => String(c.id) !== idStr)
      if (remaining.length > 0) {
        setActiveId(remaining[0].id)
      } else {
        setActiveId(null)
        setMobilePane('list')
      }
    }

    toast.success('Chat deleted', {
      action: {
        label: 'Undo',
        onClick: () => {
          setDeletedChatIds((prev) => {
            const next = prev.filter((id) => id !== idStr)
            try {
              localStorage.setItem(storageKey, JSON.stringify(next))
            } catch (_) {}
            return next
          })
          setActiveId(idStr)
          toast.info('Chat restored')
        },
      },
    })
  }, [storageKey, activeId, mine])

  const sorted = useMemo(() => {
    return [...mine].sort((a, b) => {
      const aMsgs = threadMessages[a.id] || a.messages || []
      const bMsgs = threadMessages[b.id] || b.messages || []
      const aLast = aMsgs[aMsgs.length - 1]
      const bLast = bMsgs[bMsgs.length - 1]
      return new Date(bLast?.at || 0) - new Date(aLast?.at || 0)
    })
  }, [mine, threadMessages])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((c) => {
      const msgs = threadMessages[c.id] || c.messages || []
      const last = msgs[msgs.length - 1]
      return (
        c.name.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q) ||
        c.bookingRef?.toLowerCase().includes(q) ||
        last?.text?.toLowerCase().includes(q)
      )
    })
  }, [sorted, debouncedSearch, threadMessages])

  const active = useMemo(() => mine.find((c) => c.id === activeId) || null, [mine, activeId])

  // Select initial thread if none selected
  useEffect(() => {
    if (!sorted.length) return
    if (!activeId || !mine.some((c) => c.id === activeId)) {
      setActiveId(sorted[0].id)
      if (searchParams.get('thread')) setSearchParams({}, { replace: true })
    }
  }, [sorted, mine, activeId, searchParams, setSearchParams])

  // Fetch messages and mark as read when active thread changes
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
    }

    return () => {
      isMounted = false
    }
  }, [activeId, user])

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

      // If active conversation received this message and it's from the other participant, mark as read
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

  // Auto-scroll to bottom of active thread
  const activeMessages = useMemo(() => {
    if (!active) return []
    return threadMessages[active.id] || active.messages || []
  }, [active, threadMessages])

  const messageCount = activeMessages.length
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeId, messageCount])

  const groups = useMemo(() => {
    if (!activeMessages.length) return []
    const out = []
    activeMessages.forEach((m) => {
      const key = String(m.at || '').slice(0, 10)
      const bucket = out[out.length - 1]
      if (bucket && bucket.key === key) bucket.items.push(m)
      else out.push({ key, items: [m] })
    })
    return out
  }, [activeMessages])

  const selectConversation = (c) => {
    setActiveId(c.id)
    setDraft('')
    setMobilePane('thread')
    if (typeof localMarkRead === 'function') {
      localMarkRead(c.id)
    }
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

  const handleSend = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !active) return

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    if (active && isMongoObjectId(active.id)) {
      emitTyping(active.id, false)
    }

    // Precondition check: only active bookings permit messaging
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
        // Fallback for static demo threads
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

  const today = new Date().toISOString().slice(0, 10)

  if (!mine.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Messages" subtitle="Chat with your caretakers and the Bystander support desk." />
        <div className="rounded-card border border-line bg-white shadow-card">
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Once a caretaker is assigned to your booking, your chats will appear here."
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button to="/customer/book-caregiver" icon={MessageSquare}>
                  Book a caretaker
                </Button>
                {deletedChatIds.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeletedChatIds([])
                      try {
                        localStorage.removeItem(storageKey)
                      } catch (_) {}
                      toast.success('Deleted chats restored')
                    }}
                  >
                    Restore deleted chats
                  </Button>
                )}
              </div>
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
        subtitle="Chat with your caretakers and the Bystander support desk."
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
                const msgs = threadMessages[c.id] || c.messages || []
                const last = msgs[msgs.length - 1]
                const isActive = c.id === activeId
                const unreadCount = unreadMap[c.id] ?? c.unread ?? 0

                const isMenuOpen = menuOpenId === c.id

                return (
                  <div
                    key={c.id}
                    className={cn(
                      'group relative flex w-full items-start border-b border-line text-left transition',
                      isActive ? 'bg-mint-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectConversation(c)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3.5 text-left"
                    >
                      <Avatar src={c.avatar} name={c.name} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-bold text-ink">{c.name}</span>
                          <span className="shrink-0 text-[11px] text-faint">
                            {last ? relativeTime(last.at) : ''}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {c.roleLabel ? (
                            <>
                              <span className="font-semibold text-primary-700">{c.roleLabel}</span>
                              {c.serviceTitle ? ` · ${c.serviceTitle}` : ''}
                            </>
                          ) : (
                            c.role
                          )}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-xs',
                              unreadCount > 0 ? 'font-semibold text-ink' : 'text-faint',
                            )}
                          >
                            {last?.from === 'me' ? 'You: ' : ''}
                            {last?.text || 'No messages yet'}
                          </span>
                          {unreadCount > 0 ? (
                            <span className="shrink-0 rounded-full bg-primary-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              {unreadCount}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>

                    {/* Small down arrow dropdown trigger */}
                    <div className="relative self-center pr-3" data-chat-menu>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId((prev) => (prev === c.id ? null : c.id))
                        }}
                        className={cn(
                          'grid h-7 w-7 place-items-center rounded-lg text-faint transition hover:bg-slate-200/80 hover:text-ink',
                          isMenuOpen ? 'opacity-100 bg-slate-200/80 text-ink' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 max-md:opacity-100',
                        )}
                        title="Chat options"
                        aria-label={`Options for ${c.name}`}
                      >
                        <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', isMenuOpen && 'rotate-180')} />
                      </button>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="absolute right-0 top-8 z-30 min-w-[130px] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg animate-in fade-in zoom-in-95">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setMenuOpenId(null)
                              setDeleteDialog(c)
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-danger-600 transition hover:bg-danger-50 hover:text-danger-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete chat</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
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
                {active.bookingRef ? <Chip className="shrink-0">{active.bookingRef}</Chip> : null}

                {/* Header Chat Options */}
                <div className="relative shrink-0" data-chat-menu>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setHeaderMenuOpen((prev) => !prev)
                    }}
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-lg text-faint transition hover:bg-slate-100 hover:text-ink',
                      headerMenuOpen && 'bg-slate-100 text-ink',
                    )}
                    title="Conversation options"
                    aria-label="Conversation options"
                  >
                    <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', headerMenuOpen && 'rotate-180')} />
                  </button>

                  {headerMenuOpen && (
                    <div className="absolute right-0 top-9 z-30 min-w-[130px] overflow-hidden rounded-xl border border-line bg-white py-1 shadow-lg animate-in fade-in zoom-in-95">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setHeaderMenuOpen(false)
                          setDeleteDialog(active)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-danger-600 transition hover:bg-danger-50 hover:text-danger-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete chat</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {active.canSend === false ? (
                <div className="flex items-center gap-2 border-b border-warning-200 bg-warning-50 px-4 py-2 text-xs text-warning-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning-600" />
                  <span>
                    This booking is {active.bookingStatus?.toLowerCase() || 'closed'}. Messaging is in read-only mode.
                  </span>
                </div>
              ) : null}

              <div ref={threadRef} className="thin-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-4 py-5">
                {groups.length ? (
                  groups.map((group) => (
                    <div key={group.key} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-line" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-faint">
                          {group.key === today ? 'Today' : formatDate(group.items[0]?.at, { long: true })}
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
                  ))
                ) : (
                  <div className="grid h-full place-items-center text-center">
                    <p className="text-sm text-muted">No messages in this conversation yet. Send the first message below.</p>
                  </div>
                )}
              </div>

              {partnerTyping ? (
                <div className="flex items-center gap-2 border-t border-line bg-mint-50/70 px-4 py-1.5 text-xs font-medium text-primary-700">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-600" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-600 delay-150" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-600 delay-300" />
                  </span>
                  <span>{active.name.split(' ')[0]} is typing…</span>
                </div>
              ) : null}

              <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-line bg-white px-4 py-3">
                <Input
                  value={draft}
                  onChange={handleDraftChange}
                  placeholder={
                    active.canSend === false
                      ? 'Messaging is closed for this booking'
                      : `Message ${active.name.split(' ')[0]}…`
                  }
                  aria-label="Message text"
                  disabled={active.canSend === false || sending}
                  className="flex-1"
                />
                <Button type="submit" icon={Send} disabled={!draft.trim() || active.canSend === false || sending} loading={sending}>
                  Send
                </Button>
              </form>
            </>
          ) : (
            <EmptyState
              icon={MessageSquare}
              title="Select a conversation"
              description="Pick a caretaker or support thread from the list to start reading."
            />
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={Boolean(deleteDialog)}
        onClose={() => setDeleteDialog(null)}
        onConfirm={() => handleDeleteChat(deleteDialog)}
        title="Delete chat?"
        message={`Are you sure you want to delete your conversation with ${deleteDialog?.name || 'this contact'}? This will remove the conversation from your inbox.`}
        confirmLabel="Delete chat"
        cancelLabel="Cancel"
        tone="danger"
      />
    </div>
  )
}

export default MessagesPage
