"use client"

import {
  ChatComposite,
  FluentThemeProvider,
  fromFlatCommunicationIdentifier,
  type CommunicationParticipant,
  type MessageProps,
  type MessageRenderer
} from '@azure/communication-react'
import type { ChatMessage } from '@azure/communication-chat'
import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common'
import { useCallback, useEffect, useMemo, useState } from 'react'

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

  const renderTypingIndicator = useCallback(
    (typingUsers: CommunicationParticipant[]) => {
      const relevantUsers = typingUsers.filter((user) => {
        if (!user?.userId) return false
        if (user.userId === config.userId) return false
        if (assistantAcsId && user.userId !== assistantAcsId) return false
        return true
      })
      if (!relevantUsers.length || mode !== 'ai') return null

      return (
        <div className="flex items-end gap-3 px-4 pb-3 pt-1 md:px-6">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-white shadow-md ring-1 ring-slate-200">
            <img src="/mesh.png" alt="Coach avatar" className="h-full w-full object-cover" />
          </div>
          <MessageBubble isOwn={false}>
            <div className="flex items-center gap-1 text-white">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 rounded-full bg-white/85 animate-bounce"
                  style={{ animationDelay: `${dot * 0.16}s` }}
                />
              ))}
            </div>
          </MessageBubble>
        </div>
      )
    },
    [assistantAcsId, config.userId, mode]
  )

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
          onRenderTypingIndicator={renderTypingIndicator}
          options={{
            autoFocus: 'sendBoxTextField',
            participantPane: false,
            topic: false,
            richTextEditor: false
          }}
        />
      </FluentThemeProvider>
    </div>
  )
}
