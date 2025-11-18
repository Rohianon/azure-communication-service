"use client"

import type { CommunicationUserIdentifier } from '@azure/communication-common'
import { AzureCommunicationTokenCredential } from '@azure/communication-common'
import { ChatComposite, fromFlatCommunicationIdentifier, useAzureCommunicationChatAdapter } from '@azure/communication-react'
import { initializeIcons } from '@fluentui/react'
import { CSSProperties, useEffect, useMemo, useRef, type ComponentProps, type MutableRefObject } from 'react'

import type { AzureChatConfig } from '@/lib/azureCommunication'

const BACKEND_STREAM_URL =
  process.env.NEXT_PUBLIC_CHAT_STREAM_URL || 'https://gf-mesh-backend-production.up.railway.app/chat/stream'
const BOT_PREFIX = '[Bot]'
const BOT_NAME = 'Coach MESH'
const richTextEditorEnabled = false

initializeIcons()

type AzureCommunicationAppProps = {
  config: AzureChatConfig
}

export default function AzureCommunicationApp({ config }: AzureCommunicationAppProps): JSX.Element {
  const { endpointUrl, userId, token, displayName, threadId } = config
  const welcomedRef = useRef(false)

  const credential = useMemo(() => {
    try {
      return new AzureCommunicationTokenCredential(token)
    } catch {
      console.error('Failed to construct token credential')
      return undefined
    }
  }, [token])

  const chatAdapterArgs = useMemo(
    () => ({
      endpoint: endpointUrl,
      userId: fromFlatCommunicationIdentifier(userId) as CommunicationUserIdentifier,
      displayName,
      credential,
      threadId
    }),
    [endpointUrl, userId, displayName, credential, threadId]
  )
  const chatAdapter = useAzureCommunicationChatAdapter(chatAdapterArgs)

  useBotStreaming(chatAdapter)
  useWelcomeMessage(chatAdapter, welcomedRef)

  if (!threadId) {
    return <h3>Chat thread is not configured.</h3>
  }
  if (credential === undefined) {
    return <h3>Failed to construct credential. Provided token is malformed.</h3>
  }
  if (!chatAdapter) {
    return <h3>Initializing...</h3>
  }

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div style={containerStyle}>
        <ChatComposite
          adapter={chatAdapter}
          options={{ richTextEditor: richTextEditorEnabled }}
          onRenderMessage={renderBotOnLeft}
        />
      </div>
    </div>
  )
}

const containerStyle: CSSProperties = {
  border: 'solid 0.125rem olive',
  margin: '0.5rem',
  width: '100vw'
}

function useWelcomeMessage(
  chatAdapter: ReturnType<typeof useAzureCommunicationChatAdapter>,
  welcomedRef: MutableRefObject<boolean>
) {
  useEffect(() => {
    if (!chatAdapter) return
    if (welcomedRef.current) return

    welcomedRef.current = true
    chatAdapter.sendMessage(
      `${BOT_PREFIX} Hi there! I'm ${BOT_NAME}—here to keep your money habits on track. Tell me what you're working on today or ask me anything.`
    )
  }, [chatAdapter, welcomedRef])
}

function useBotStreaming(chatAdapter: ReturnType<typeof useAzureCommunicationChatAdapter>) {
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

function renderBotOnLeft(
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

