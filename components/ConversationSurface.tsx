"use client"

import {
  ChatComposite,
  FluentThemeProvider,
  fromFlatCommunicationIdentifier,
  type ChatAdapterState,
  type MessageProps,
  type MessageRenderer
} from '@azure/communication-react'
import type { ChatMessage } from '@azure/communication-chat'
import {
  AzureCommunicationTokenCredential,
  CommunicationUserIdentifier,
  getIdentifierRawId
} from '@azure/communication-common'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  ADAPTIVE_CARD_METADATA_KEY,
  ADAPTIVE_CARD_METADATA_VALUE,
  type AdaptiveCardAction,
  type AdaptiveCardButtonAction,
  type AdaptiveCardContent,
  type AdaptiveCardOpenUrlAction
} from '@/lib/constants/adaptiveCards'
import { useAiResponderBridge, useAutoReadReceipts } from '@/lib/hooks/chatInstrumentation'
import { type AdaptiveCardsChatAdapterOptions, useChatAdapterWithOptions } from '@/lib/hooks/useChatAdapterWithOptions'
import type { AzureChatCredentials, ChatThreadMode } from '@/lib/types/chat'
import { ChatMarkdown } from './ChatMarkdown'
import MessageBubble from './MessageBubble'
import WaveLoader from './WaveLoader'

type Props = {
  config: AzureChatCredentials
  threadId: string
  mode: ChatThreadMode
  userId: string
  phoneNumber?: string | null
  assistantAcsId?: string | null
}

const parseAdaptiveCardContent = (content: string | undefined): AdaptiveCardContent | null => {
  if (!content) return null
  try {
    const maybeCard = JSON.parse(content) as AdaptiveCardContent
    return maybeCard?.type === 'AdaptiveCard' ? maybeCard : null
  } catch {
    return null
  }
}

export default function ConversationSurface({ config, threadId, mode, userId, phoneNumber, assistantAcsId }: Props) {
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

  const chatAdapterOptions = useMemo<AdaptiveCardsChatAdapterOptions>(
    () => ({
      enableAdaptiveCards: true
    }),
    []
  )

  const adapter = useChatAdapterWithOptions({
    ...adapterArgs,
    userId: adapterArgs.userId as CommunicationUserIdentifier,
    chatAdapterOptions
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

  const renderMessage = useCallback(
    (messageProps: MessageProps, defaultOnRender?: MessageRenderer) => {
      if (!defaultOnRender) return null

      const { message, onSendMessage } = messageProps
      if (message.messageType !== 'chat') {
        return defaultOnRender(messageProps)
      }

      const chatMessage = message as ChatMessage & { metadata?: Record<string, string> }
      const metadataValue = chatMessage.metadata?.[ADAPTIVE_CARD_METADATA_KEY]
      const isAdaptiveMetadata = metadataValue === ADAPTIVE_CARD_METADATA_VALUE
      const parsedCard = isAdaptiveMetadata ? parseAdaptiveCardContent(chatMessage.content) : null
      const fallbackParsedCard = parsedCard ?? parseAdaptiveCardContent(chatMessage.content)

      const timestampLabel = chatMessage.createdOn?.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      })
      const isOwn = Boolean(chatMessage.mine)

      if (fallbackParsedCard) {
        const primaryText = fallbackParsedCard.body
          .filter((item) => item.type === 'TextBlock')
          .map((item) => item.text)
          .join('\n')

        const renderAction = (action: AdaptiveCardAction, index: number) => {
          if (action.type === 'Action.OpenUrl') {
            const openUrlAction = action as AdaptiveCardOpenUrlAction
            return (
              <a
                key={`${openUrlAction.title}-${index}`}
                href={openUrlAction.url}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-xl bg-white/10 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/15 active:scale-[0.99]"
              >
                {openUrlAction.title}
              </a>
            )
          }

          const submitAction = action as AdaptiveCardButtonAction
          const payload =
            typeof submitAction.data === 'object' &&
            submitAction.data &&
            'action' in submitAction.data &&
            typeof submitAction.data.action === 'string'
              ? submitAction.data.action
              : submitAction.title

          const handleClick = () => {
            if (!onSendMessage) return
            onSendMessage(payload).catch((error) => console.error('Failed to send submit action', error))
          }

          return (
            <button
              key={`${submitAction.title}-${index}`}
              type="button"
              onClick={handleClick}
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/15 active:scale-[0.99]"
            >
              {submitAction.title}
            </button>
          )
        }

        return (
          <MessageBubble isOwn={isOwn} timestamp={timestampLabel}>
            <div className="flex flex-col gap-3 text-white">
              {primaryText ? <ChatMarkdown content={primaryText} /> : null}
              {fallbackParsedCard.actions?.length ? (
                <div className="flex flex-col gap-2">{fallbackParsedCard.actions.map(renderAction)}</div>
              ) : null}
            </div>
          </MessageBubble>
        )
      }

      const content = chatMessage.content ?? ''

      return (
        <MessageBubble isOwn={isOwn} timestamp={timestampLabel}>
          <ChatMarkdown content={content} />
        </MessageBubble>
      )
    },
    []
  )

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

      const assistantIsTyping = typingIndicators.some((indicator) => {
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
        <p className="text-xs text-slate-500">Hang tight while we initialize your chat adapter.</p>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 acs-shell">
      <FluentThemeProvider>
        <ChatComposite
          adapter={adapter}
          formFactor={formFactor}
          onRenderMessage={renderMessage}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-20 flex justify-start px-4">
          <div className="pointer-events-auto">
            <MessageBubble isOwn={false}>
              <div className="flex items-center gap-1.5 text-white">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="h-2 w-2 rounded-full bg-white/80 animate-bounce"
                    style={{ animationDelay: `${dot * 0.15}s` }}
                  />
                ))}
              </div>
            </MessageBubble>
          </div>
        </div>
      ) : null}
    </div>
  )
}
