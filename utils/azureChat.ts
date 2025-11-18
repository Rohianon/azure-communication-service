import { useEffect, type ComponentProps, type MutableRefObject } from 'react'

import type { ChatComposite } from '@azure/communication-react'
import { useAzureCommunicationChatAdapter } from '@azure/communication-react'

export const BOT_PREFIX = '[Bot]'
export const BOT_NAME = 'Coach MESH'
export const BACKEND_STREAM_URL =
  process.env.NEXT_PUBLIC_CHAT_STREAM_URL || 'https://gf-mesh-backend-production.up.railway.app/chat/stream'

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

export function useBotStreaming(chatAdapter: ChatAdapter) {
  useEffect(() => {
    if (!chatAdapter) return

    const handler = (event: unknown) => {
      const content = extractMessageContent(event)
      if (!content || content.startsWith(BOT_PREFIX)) return
      streamBackendAndPostReply(chatAdapter, content)
    }

    chatAdapter.on('messageSent', handler)
    return () => {
      chatAdapter.off('messageSent', handler)
    }
  }, [chatAdapter])
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

function extractMessageContent(event: unknown): string | null {
  if (!event || typeof event !== 'object') return null
  const message = (event as { message?: unknown }).message
  if (message && typeof message === 'object') {
    const content = (message as { content?: unknown }).content
    if (content && typeof content === 'object') {
      const msg = (content as { message?: unknown }).message
      const plainText = (content as { plainText?: unknown }).plainText
      if (typeof msg === 'string') return msg
      if (typeof plainText === 'string') return plainText
    }
  }
  return null
}

async function streamBackendAndPostReply(
  chatAdapter: NonNullable<ReturnType<typeof useAzureCommunicationChatAdapter>>,
  userContent: string
) {
  try {
    const res = await fetch(BACKEND_STREAM_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          content: userContent,
          additionalProp1: {}
        },
        config: {},
        kwargs: {
          additionalProp1: {}
        }
      })
    })

    if (!res.ok || !res.body) {
      throw new Error(`Backend responded with ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let assembled = ''

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue

        const chunk = parseStreamChunk(data)
        if (!chunk) continue
        assembled += chunk
      }
    }

    if (assembled.trim().length) {
      await chatAdapter.sendMessage(`${BOT_PREFIX} ${assembled}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    await chatAdapter.sendMessage(`${BOT_PREFIX} (stream error) ${message}`)
  }
}

function parseStreamChunk(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:metadata')) return null

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed === 'string') {
      if (parsed.startsWith('data:metadata')) return null
      return parsed
    }
    if (parsed && typeof parsed === 'object') {
      // Skip metadata-like envelopes.
      if ('run_id' in (parsed as Record<string, unknown>)) return null
      const maybeContent = (parsed as { content?: unknown }).content
      const maybeText = (parsed as { text?: unknown }).text
      if (typeof maybeContent === 'string') return maybeContent
      if (typeof maybeText === 'string') return maybeText
      return null
    }
  } catch {
    // not JSON, fall through
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null
  return trimmed
}
