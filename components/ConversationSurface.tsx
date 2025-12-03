"use client"

import {
  ChatComposite,
  FluentThemeProvider,
  fromFlatCommunicationIdentifier,
  useAzureCommunicationChatAdapter
} from '@azure/communication-react'
import type { ChatAdapterState, MessageProps, MessageRenderer } from '@azure/communication-react'
import type { ChatMessage } from '@azure/communication-chat'
import {
  AzureCommunicationTokenCredential,
  CommunicationUserIdentifier,
  getIdentifierRawId
} from '@azure/communication-common'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAiResponderBridge, useAutoReadReceipts } from '@/lib/hooks/chatInstrumentation'
import type { AzureChatCredentials, ChatThreadMode } from '@/lib/types/chat'
import WaveLoader from './WaveLoader'
import { ChatMarkdown } from './ChatMarkdown'
import MessageBubble from './MessageBubble'

type Props = {
  config: AzureChatCredentials
  threadId: string
  mode: ChatThreadMode
  userId: string
  phoneNumber?: string | null
  assistantAcsId?: string | null
}

export default function ConversationSurface({
  config,
  threadId,
  mode,
  userId,
  phoneNumber,
  assistantAcsId
}: Props) {
  const credential = useMemo(() => new AzureCommunicationTokenCredential(config.token), [config.token])

  const adapterArgs = useMemo(
    () => ({
      endpoint: config.endpointUrl,
      userId: fromFlatCommunicationIdentifier(config.userId),
      displayName: config.displayName,
      credential,
      threadId: config.threadId
    }),
    [config, credential]
  )

  const adapter = useAzureCommunicationChatAdapter({
    ...adapterArgs,
    userId: adapterArgs.userId as CommunicationUserIdentifier
  })

  useAutoReadReceipts(adapter, config.userId)
  useAiResponderBridge(adapter, {
    threadId,
    threadMode: mode,
    currentUserAcsId: config.userId,
    currentUserId: userId,
    currentUserPhoneNumber: phoneNumber ?? null
  })

  const [formFactor, setFormFactor] = useState<'mobile' | 'desktop'>(() =>
    typeof window === 'undefined' ? 'desktop' : window.innerWidth < 768 ? 'mobile' : 'desktop'
  )

  useEffect(() => {
    const updateFormFactor = () => {
      setFormFactor(window.innerWidth < 768 ? 'mobile' : 'desktop')
    }
    updateFormFactor()
    window.addEventListener('resize', updateFormFactor)
    return () => window.removeEventListener('resize', updateFormFactor)
  }, [])

  const renderMessageBubble = useCallback((messageProps: MessageProps, defaultOnRender?: MessageRenderer) => {
    if (!defaultOnRender) return null

    const { message } = messageProps
    if (message.messageType !== 'chat') {
      return defaultOnRender(messageProps)
    }

    const chatMessage = message as typeof message & { metadata?: Record<string, string> }
    const metadata = chatMessage.metadata ?? {}
    const botContentType = metadata['microsoft.azure.communication.chat.bot.contenttype']

    let isAdaptiveCard = typeof botContentType === 'string' && botContentType === 'azurebotservice.adaptivecard'
    if (!isAdaptiveCard && typeof message.content === 'string') {
      try {
        const parsed = JSON.parse(message.content) as {
          attachments?: Array<{ contentType?: string }>
        }
        if (Array.isArray(parsed.attachments)) {
          isAdaptiveCard = parsed.attachments.some(
            attachment => attachment?.contentType === 'application/vnd.microsoft.card.adaptive'
          )
        }
      } catch {
        // ignore invalid JSON payloads
      }
    }

    if (isAdaptiveCard) {
      return defaultOnRender(messageProps)
    }

    const content = message.content ?? ''
    const isOwn = Boolean(message.mine)
    const timestampLabel = message.createdOn?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

    return (
      <MessageBubble isOwn={isOwn} timestamp={timestampLabel}>
        <ChatMarkdown content={content} />
      </MessageBubble>
    )
  }, [])

  const fetchAvatarPersonaData = useCallback(
    async (targetUserId: string) => {
      if (assistantAcsId && targetUserId === assistantAcsId) {
        return {
          imageUrl: '/mesh.png',
          text: 'Mesh Assistant'
        }
      }
      return { imageInitials: undefined }
    },
    [assistantAcsId]
  )

  const [assistantTyping, setAssistantTyping] = useState(false)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (mode !== 'ai') {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      setAssistantTyping(false)
      return
    }
    if (!adapter) return

    const handleTypingStateChange = (state: ChatAdapterState) => {
      const typingIndicators = state.thread?.typingIndicators ?? []

      const assistantIsTyping = typingIndicators.some(indicator => {
        if (!indicator?.sender) return false
        const senderRawId = getIdentifierRawId(indicator.sender as CommunicationUserIdentifier)
        if (!senderRawId || senderRawId === config.userId) return false
        if (assistantAcsId && senderRawId !== assistantAcsId) return false
        return true
      })

      if (!assistantIsTyping) {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = null
        }
        setAssistantTyping(false)
        return
      }

      setAssistantTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setAssistantTyping(false), 3500)
    }

    const handleMessage = (event: { message: ChatMessage }) => {
      if (!event?.message) return
      const senderRawId = event.message.sender
        ? getIdentifierRawId(event.message.sender as CommunicationUserIdentifier)
        : null
      if (!senderRawId || senderRawId === config.userId) return
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      setAssistantTyping(false)
    }

    adapter.onStateChange(handleTypingStateChange)
    handleTypingStateChange(adapter.getState())
    adapter.on('messageReceived', handleMessage)
    return () => {
      adapter.offStateChange(handleTypingStateChange)
      adapter.off('messageReceived', handleMessage)
    }
  }, [adapter, assistantAcsId, config.userId, mode])

  if (!adapter) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-800/70 text-center text-slate-300">
        <WaveLoader className="mx-auto mb-4" />
        <p className="text-sm font-semibold">Connecting to Azure Communication Services…</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 acs-shell">
      <FluentThemeProvider>
        <ChatComposite
          adapter={adapter}
          formFactor={formFactor}
          onRenderMessage={renderMessageBubble}
          onFetchAvatarPersonaData={fetchAvatarPersonaData}
          options={{
            autoFocus: 'sendBoxTextField',
            participantPane: false,
            topic: false,
            richTextEditor: false
          }}
        />
      </FluentThemeProvider>
      {assistantTyping && mode === 'ai' ? (
        <div className="absolute inset-x-0 bottom-24 z-20 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-slate-800/90 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur">
            <WaveLoader className="h-3" barCount={3} />
            <span className="opacity-80">Coach is typing...</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}
