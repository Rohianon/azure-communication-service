import { useEffect, type ComponentProps, type MutableRefObject } from 'react'

import type { ChatComposite } from '@azure/communication-react'
import { useAzureCommunicationChatAdapter } from '@azure/communication-react'

export const BOT_PREFIX = '[Bot]'
export const BOT_NAME = 'Coach MESH'

type ChatAdapter = ReturnType<typeof useAzureCommunicationChatAdapter>

export function useWelcomeMessage(chatAdapter: ChatAdapter, welcomedRef: MutableRefObject<boolean>) {
  useEffect(() => {
    if (!chatAdapter) return
    if (welcomedRef.current) return

    welcomedRef.current = true
    chatAdapter.sendMessage(
      `${BOT_PREFIX} Hi there! I'm ${BOT_NAME}—here to keep your money habits on track. Tell me what you're working on today or ask me anything.`
    )
  }, [chatAdapter, welcomedRef])
}

export function useReadReceipts(chatAdapter: ChatAdapter, currentUserId: string) {
  useEffect(() => {
    if (!chatAdapter) return

    const handler = async (event: unknown) => {
      const message = (event as { message?: { id?: string; sender?: { rawId?: string; communicationUserId?: string } } }).message
      const messageId = message?.id
      const senderId = message?.sender?.communicationUserId ?? message?.sender?.rawId
      if (!messageId) return
      if (senderId && senderId === currentUserId) return

      if ('sendReadReceipt' in chatAdapter && typeof chatAdapter.sendReadReceipt === 'function') {
        try {
          await chatAdapter.sendReadReceipt(messageId)
        } catch (error) {
          console.warn('Failed to send read receipt', error)
        }
      }
    }

    chatAdapter.on('messageReceived', handler)
    return () => {
      chatAdapter.off('messageReceived', handler)
    }
  }, [chatAdapter, currentUserId])
}

export function useTypingIndicator(chatAdapter: ChatAdapter) {
  useEffect(() => {
    if (!chatAdapter) return
    const hasTyping = 'sendTypingIndicator' in chatAdapter && typeof chatAdapter.sendTypingIndicator === 'function'
    if (!hasTyping) return

    let cooldown: ReturnType<typeof setTimeout> | null = null
    const triggerTyping = () => {
      if (cooldown) return
      chatAdapter.sendTypingIndicator().catch((error: unknown) => {
        console.warn('Failed to send typing indicator', error)
      })
      cooldown = setTimeout(() => {
        cooldown = null
      }, 8000)
    }

    const inputListener = (event: Event) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const role = target.getAttribute('role')
      if (role === 'textbox') {
        triggerTyping()
      }
    }

    document.addEventListener('input', inputListener, true)
    return () => {
      document.removeEventListener('input', inputListener, true)
      if (cooldown) clearTimeout(cooldown)
    }
  }, [chatAdapter])
}

export function renderBotOnLeft(
  messageProps: Parameters<NonNullable<ComponentProps<typeof ChatComposite>['onRenderMessage']>>[0],
  defaultOnRender?: Parameters<NonNullable<ComponentProps<typeof ChatComposite>['onRenderMessage']>>[1]
) {
  const content = getMessageContent(messageProps.message)
  const startsWithBot = typeof content === 'string' && content.startsWith(BOT_PREFIX)
  if (!startsWithBot) {
    return defaultOnRender ? defaultOnRender(messageProps) : null
  }

  const trimmed = content.replace(/^\[Bot\]\s*/, '')
  const originalContent = (messageProps.message as { content?: { message?: string } }).content ?? {}
  const modifiedProps: typeof messageProps = {
    ...messageProps,
    message: {
      ...messageProps.message,
      mine: false,
      senderDisplayName: BOT_NAME,
      content: {
        ...originalContent,
        message: trimmed
      }
    }
  }

  return defaultOnRender ? defaultOnRender(modifiedProps) : null
}

function getMessageContent(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null
  const content = (message as { content?: unknown }).content
  if (!content || typeof content !== 'object') return null
  const text = (content as { message?: unknown }).message
  return typeof text === 'string' ? text : null
}
