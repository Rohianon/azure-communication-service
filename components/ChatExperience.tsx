"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'

import { HARD_CODED_USERS } from '@/lib/constants/users'
import { type AiAssistantProfile, type AzureChatCredentials, type SerializableThread, type SerializableUser } from '@/lib/types/chat'
import { createThread, getChatConfig, getUserThreads } from '@/lib/apiClient'
import { initials, presenceColor } from '@/lib/utils/uiHelpers'

import ConversationSurface from './ConversationSurface'
import AuthModal from './AuthModal'
import SidebarPanel from './SidebarPanel'
import EmptyScreen from './EmptyScreen'
import { ContactListItem } from './ContactList'

const AUTH_STORAGE_KEY = 'mesh.dm.user'
const ASSISTANT_ACCENT = '#F472B6'
const CHAT_CONFIG_CACHE_TTL_MS = 15 * 60 * 1000

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

    const loadThreads = async () => {
      try {
        const payload = await getUserThreads(activeUserId, controller.signal)
        setThreads(payload.threads)
        if (!payload.threads.length) {
          handleThreadSelection(null)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Unable to load conversations')
        setThreads([])
        handleThreadSelection(null)
      } finally {
        if (!controller.signal.aborted) {
          setLoadingThreads(false)
        }
      }
    }

    loadThreads()

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

    const fetchChatConfig = async () => {
      try {
        const payload = await getChatConfig(activeUserId, targetThreadId, controller.signal)
        rememberConfig(targetThreadId, payload.config)
        setChatConfig(payload.config)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : 'Unable to initialize chat adapter')
        setChatConfig(null)
      } finally {
        if (!controller.signal.aborted) {
          setLoadingConfig(false)
        }
      }
    }

    fetchChatConfig()

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
      avatarUrl: '/mesh.png',
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
        const payload = await createThread(
          role === 'assistant'
            ? { initiatorId: activeUserId, mode: 'ai' }
            : { initiatorId: activeUserId, peerId: contactId, mode: 'user' }
        )
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

  const activePeer = useMemo(() => {
    if (!focusedContactId) return null
    return contacts.find(c => c.id === focusedContactId)
  }, [contacts, focusedContactId])

  return (
    <div className="h-screen overflow-hidden">
      <AuthModal open={showAuthModal} onSelectUser={handleProfileSelect} />
      <section className="relative mx-auto flex h-full max-w-6xl flex-col gap-4 overflow-hidden px-4 py-6 lg:flex-row lg:gap-6">
        <SidebarPanel
          open={sidebarOpen}
          toggleSidebar={toggleSidebar}
          activeProfile={activeUserProfile}
          contacts={contacts}
          focusedContactId={focusedContactId}
          contactsDisabled={!activeUserId || loadingThreads}
          loadingThreads={loadingThreads}
          onContactPress={handleContactPress}
          onSignOut={handleSignOut}
          onCloseMobile={closeSidebarOnMobile}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/5">
          {error ? <div className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div> : null}

          {activePeer && (
            <div className="flex items-center gap-3 border-b border-white/5 bg-slate-900/50 px-5 py-3 backdrop-blur-md">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full shadow-inner ring-1 ring-white/10">
                {activePeer.avatarUrl ? (
                  <Image src={activePeer.avatarUrl} alt="Peer" width={32} height={32} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold" style={{ color: activePeer.accentColor }}>{initials(activePeer.displayName)}</span>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">{activePeer.displayName}</h2>
                <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${presenceColor(activePeer.presence)}`} />
                  {activePeer.presence}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-1 min-h-0 overflow-hidden relative">
            {activeThread && chatConfig && activeUserId ? (
              <ConversationSurface
                config={chatConfig}
                threadId={activeThread.id}
                mode={activeThread.mode}
                userId={activeUserId}
                phoneNumber={activeUserProfile?.externalId ?? null}
                assistantAcsId={assistant.acsIdentity ?? null}
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