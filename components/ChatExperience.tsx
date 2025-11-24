"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { HARD_CODED_USERS } from '@/lib/constants/users'
import type { AiAssistantProfile, AzureChatCredentials, ChatThreadMode, PresenceStatus } from '@/lib/types/chat'

import ConversationSurface from './ConversationSurface'
import AuthModal from './AuthModal'
import SidebarPanel from './SidebarPanel'
import EmptyScreen from './EmptyScreen'
import { ContactListItem } from './ContactList'

const AUTH_STORAGE_KEY = 'mesh.dm.user'
const ASSISTANT_ACCENT = '#F472B6'
const CHAT_CONFIG_CACHE_TTL_MS = 15 * 60 * 1000

type SerializableUser = {
  id: string
  displayName: string
  role: 'human' | 'assistant'
  accentColor: string
  externalId?: string
  presence: PresenceStatus
  createdAt: string
  lastSeenAt: string
}

type SerializableThread = {
  id: string
  acsThreadId: string
  mode: ChatThreadMode
  topic: string
  participantIds: string[]
  createdAt: string
  lastActivityAt: string
  lastMessagePreview?: string
  unreadCount?: number
}

type Props = {
  initialUsers: SerializableUser[]
  assistant: AiAssistantProfile
}

export default function ChatExperience({ initialUsers, assistant }: Props) {
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [threads, setThreads] = useState<SerializableThread[]>([])
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [chatConfig, setChatConfig] = useState<AzureChatCredentials | null>(null)
  const [loadingThreads, setLoadingThreads] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [focusedContactId, setFocusedContactId] = useState<string | null>(null)
  const [authBootstrapped, setAuthBootstrapped] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktopView, setIsDesktopView] = useState(false)
  const configCacheRef = useRef(new Map<string, { config: AzureChatCredentials; fetchedAt: number }>())

  const rememberConfig = useCallback((threadId: string, config: AzureChatCredentials) => {
    configCacheRef.current.set(threadId, { config, fetchedAt: Date.now() })
  }, [])

  const clearConfigCache = useCallback(() => {
    configCacheRef.current.clear()
  }, [])

  const activeUserProfile = useMemo(
    () => initialUsers.find((user) => user.id === activeUserId) ?? null,
    [initialUsers, activeUserId]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (stored && initialUsers.some((user) => user.id === stored)) {
      setActiveUserId(stored)
    }
    setAuthBootstrapped(true)
  }, [initialUsers])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const syncSidebar = () => {
      const desktop = mediaQuery.matches
      setIsDesktopView(desktop)
      if (desktop) {
        setSidebarOpen((current) => (current ? current : true))
      } else {
        setSidebarOpen(false)
      }
    }
    syncSidebar()
    mediaQuery.addEventListener('change', syncSidebar)
    return () => mediaQuery.removeEventListener('change', syncSidebar)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((current) => !current)
  }, [])

  const closeSidebarOnMobile = useCallback(() => {
    if (!isDesktopView) {
      setSidebarOpen(false)
    }
  }, [isDesktopView])

  const handleThreadSelection = useCallback((threadId: string | null) => {
    setSelectedThreadId(threadId)
    setError(null)
    if (!threadId) {
      setChatConfig(null)
      setLoadingConfig(false)
      return
    }
    const cached = configCacheRef.current.get(threadId)
    if (cached && Date.now() - cached.fetchedAt < CHAT_CONFIG_CACHE_TTL_MS) {
      setChatConfig(cached.config)
      setLoadingConfig(false)
      return
    }
    setChatConfig(null)
    setLoadingConfig(true)
  }, [])

  useEffect(() => {
    if (!activeUserId) {
      setThreads([])
      setSelectedThreadId(null)
      setChatConfig(null)
      setFocusedContactId(null)
      setLoadingThreads(false)
      return
    }

    setLoadingThreads(true)
    const controller = new AbortController()

    fetch(`/api/users/${activeUserId}/threads`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load threads')
        }
        const payload = (await response.json()) as { threads: SerializableThread[] }
        setThreads(payload.threads)
        if (!payload.threads.length) {
          handleThreadSelection(null)
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Unable to load conversations')
        setThreads([])
        handleThreadSelection(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingThreads(false)
        }
      })

    return () => controller.abort()
  }, [activeUserId, handleThreadSelection])

  useEffect(() => {
    if (!activeUserId || !selectedThreadId) {
      return
    }

    const cached = configCacheRef.current.get(selectedThreadId)
    if (cached && Date.now() - cached.fetchedAt < CHAT_CONFIG_CACHE_TTL_MS) {
      return
    }

    const controller = new AbortController()
    const targetThreadId = selectedThreadId

    fetch('/api/chat/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: activeUserId, threadId: targetThreadId }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Unable to initialize chat adapter')
        }
        const payload = (await response.json()) as { config: AzureChatCredentials }
        rememberConfig(targetThreadId, payload.config)
        setChatConfig(payload.config)
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Unable to initialize chat adapter')
        setChatConfig(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingConfig(false)
        }
      })

    return () => controller.abort()
  }, [activeUserId, selectedThreadId, rememberConfig])

  useEffect(() => {
    if (!selectedThreadId || !activeUserId) return
    const thread = threads.find((item) => item.id === selectedThreadId)
    if (!thread) return
    const peerId = thread.participantIds.find((id) => id !== activeUserId) ?? assistant.id
    setFocusedContactId(peerId)
  }, [selectedThreadId, threads, activeUserId, assistant.id])

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  )

  const contactThreadLookup = useMemo(() => {
    const map = new Map<string, SerializableThread>()
    if (!activeUserId) return map
    threads.forEach((thread) => {
      if (!thread.participantIds.includes(activeUserId)) return
      const peerId = thread.participantIds.find((id) => id !== activeUserId)
      if (peerId) {
        map.set(peerId, thread)
      }
    })
    return map
  }, [threads, activeUserId])

  const contactDirectory = useMemo(
    () => initialUsers.filter((user) => user.role === 'human'),
    [initialUsers]
  )

  const contacts = useMemo<ContactListItem[]>(() => {
    const aiThread = contactThreadLookup.get(assistant.id)
    const aiContact: ContactListItem = {
      id: assistant.id,
      displayName: assistant.displayName,
      description: assistant.tagline,
      accentColor: ASSISTANT_ACCENT,
      presence: 'online',
      role: 'assistant',
      lastMessagePreview: aiThread?.lastMessagePreview,
      lastActivityAt: aiThread?.lastActivityAt,
      unreadCount: aiThread?.unreadCount ?? 0
    }

    const humanContacts = contactDirectory.map((user) => {
      const thread = contactThreadLookup.get(user.id)
      return {
        id: user.id,
        displayName: user.displayName,
        description: user.id === 'guest' ? 'Shared profile' : 'Mesh member',
        accentColor: user.accentColor,
        presence: user.presence,
        role: 'human' as const,
        disabled: user.id === activeUserId,
        isSelf: user.id === activeUserId,
        lastMessagePreview: thread?.lastMessagePreview,
        lastActivityAt: thread?.lastActivityAt,
        unreadCount: thread?.unreadCount ?? 0
      }
    })

    return [aiContact, ...humanContacts]
  }, [assistant, contactDirectory, contactThreadLookup, activeUserId])

  const upsertThread = useCallback((thread: SerializableThread) => {
    setThreads((current) => {
      const index = current.findIndex((item) => item.id === thread.id)
      if (index >= 0) {
        const clone = current.slice()
        clone[index] = thread
        return clone
      }
      return [thread, ...current]
    })
    setLoadingThreads(false)
  }, [])

  const handleContactPress = useCallback(
    async (contactId: string, role: 'assistant' | 'human') => {
      if (!activeUserId) return
      if (role === 'human' && contactId === activeUserId) return
      setFocusedContactId(contactId)
      setError(null)
      setLoadingThreads(true)
      try {
        const response = await fetch('/api/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            role === 'assistant'
              ? { initiatorId: activeUserId, mode: 'ai' }
              : { initiatorId: activeUserId, peerId: contactId, mode: 'user' }
          )
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error ?? 'Unable to start conversation')
        }
        const payload = (await response.json()) as { thread: SerializableThread; config?: AzureChatCredentials }
        upsertThread(payload.thread)
        if (payload.config) {
          rememberConfig(payload.thread.id, payload.config)
        }
        handleThreadSelection(payload.thread.id)
        closeSidebarOnMobile()
      } catch (err) {
        setFocusedContactId(null)
        setError(err instanceof Error ? err.message : 'Unable to start conversation')
        setLoadingThreads(false)
      }
    },
    [activeUserId, closeSidebarOnMobile, handleThreadSelection, rememberConfig, upsertThread]
  )

  const handleSignOut = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
    }
    clearConfigCache()
    setActiveUserId(null)
    setThreads([])
    setSelectedThreadId(null)
    setChatConfig(null)
    setFocusedContactId(null)
    setLoadingConfig(false)
  }, [clearConfigCache])

  const handleProfileSelect = useCallback(
    async (userId: string) => {
      const match = HARD_CODED_USERS.find((user) => user.id === userId)
      if (!match) {
        throw new Error('Profile not found')
      }
      clearConfigCache()
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTH_STORAGE_KEY, match.id)
      }
      setActiveUserId(match.id)
      setLoadingThreads(true)
    },
    [clearConfigCache]
  )

  const showAuthModal = authBootstrapped && !activeUserId

  return (
    <div>
      <AuthModal open={showAuthModal} onSelectUser={handleProfileSelect} /> 
      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6 lg:flex-row lg:gap-6">
        <SidebarPanel
          open={sidebarOpen}
          toggleSidebar={toggleSidebar}
          activeProfile={activeUserProfile}
          contacts={contacts}
          focusedContactId={focusedContactId}
          contactsDisabled={!activeUserId || loadingThreads}
          loadingThreads={loadingThreads}
          threads={threads}
          selectedThreadId={selectedThreadId}
          onContactPress={handleContactPress}
          onThreadSelect={(threadId) => {
            handleThreadSelection(threadId)
            closeSidebarOnMobile()
          }}
          onSignOut={handleSignOut}
          onCloseMobile={closeSidebarOnMobile}
        />
        <div className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col gap-4 overflow-hidden rounded-3xl bg-slate-950/50 p-4 shadow-2xl ring-1 ring-slate-900/40 sm:p-6">
          {error ? <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}
          <div className="flex flex-1 min-h-0">
            {activeThread && chatConfig && activeUserId ? (
              <ConversationSurface
                config={chatConfig}
                threadId={activeThread.id}
                mode={activeThread.mode}
                userId={activeUserId}
                phoneNumber={activeUserProfile?.externalId ?? null}
              />
            ) : (
              <EmptyScreen loggedIn={Boolean(activeUserId)} loading={loadingThreads || loadingConfig} />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}



