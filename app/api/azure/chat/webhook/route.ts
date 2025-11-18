import { NextRequest, NextResponse } from 'next/server'

import { ChatClient } from '@azure/communication-chat'
import { AzureCommunicationTokenCredential } from '@azure/communication-common'
import { CommunicationIdentityClient } from '@azure/communication-identity'

const CONNECTION_STRING = process.env.NEXT_ACS_CONNECTION_STRING
const STREAM_URL =
  process.env.AZURE_BOT_STREAM_URL ?? process.env.NEXT_PUBLIC_CHAT_STREAM_URL ?? 'https://gf-mesh-backend-production.up.railway.app/chat/stream'
const BOT_DISPLAY_NAME = process.env.AZURE_BOT_DISPLAY_NAME ?? 'Coach MESH'
const BOT_PREFIX = '[Bot]'

type EventGridEnvelope = {
  id?: string
  subject?: string
  eventType?: string
  type?: string
  data?: {
    validationCode?: string
    messageBody?: unknown
    threadId?: string
    messageId?: string
    messageType?: string
    senderCommunicationIdentifier?: unknown
    senderDisplayName?: string
  }
}

type CachedBotIdentity = {
  userId: string
  token: string
  expiresOn: Date
}

let cachedBotIdentity: CachedBotIdentity | null = null

/**
 * Azure Event Grid webhook for ACS events.
 * - Handles subscription validation handshakes.
 * - For chat messages, fetches a bot reply from the backend stream and posts it to the thread.
 */
export async function POST(request: NextRequest) {
  const aegEventType = request.headers.get('aeg-event-type')
  const payload = await request.json().catch(() => null)

  const validationCode = extractValidationCode(payload, aegEventType)
  if (validationCode) {
    console.log('ACS webhook: responding to validation', { aegEventType, validationCode })
    return NextResponse.json({ validationResponse: validationCode })
  }

  const events = normalizeEvents(payload)
  if (!events.length) {
    return NextResponse.json({ status: 'ignored', reason: 'no events parsed' }, { status: 400 })
  }

  console.log('ACS webhook: notifications received', {
    aegEventType,
    count: events.length,
    eventTypes: events.map((e) => e.eventType ?? e.type)
  })

  // Process events in the background while we ACK quickly.
  void processNotifications(events)

  return NextResponse.json({ status: 'accepted' }, { status: 202 })
}

async function processNotifications(events: EventGridEnvelope[]) {
  for (const event of events) {
    const eventType = event.eventType ?? event.type
    if (eventType === 'Microsoft.Communication.ChatMessageReceived') {
      await handleChatMessageEvent(event)
    } else if (eventType === 'Microsoft.Communication.ChatMessageEdited') {
      console.info('Chat message edited (noop)', { id: event.id })
    } else if (eventType === 'Microsoft.Communication.ChatThreadCreatedWithUser') {
      console.info('Chat thread created (noop)', { id: event.id })
    } else {
      console.debug('Unhandled ACS event', { eventType, id: event.id })
    }
  }
}

async function handleChatMessageEvent(event: EventGridEnvelope) {
  if (!CONNECTION_STRING) {
    console.error('Missing NEXT_ACS_CONNECTION_STRING')
    return
  }

  const data = event.data ?? {}
  const threadId = data.threadId
  const messageId = data.messageId
  const messageType = data.messageType
  const senderDisplayName = data.senderDisplayName
  let messageBody = extractMessageBody(data)

  if (!messageBody && messageId) {
    messageBody = await fetchMessageBodyFromThread(threadId, messageId).catch(() => null)
    if (messageBody) {
      console.log('Resolved message body via thread lookup', { threadId, messageId })
    }
  }

  if (!threadId || !messageBody) {
    console.warn('Missing threadId or messageBody on ACS message', { threadId, id: event.id })
    return
  }

  // Skip bot/self messages to avoid loops.
  if ((typeof messageBody === 'string' && messageBody.trim().startsWith(BOT_PREFIX)) || senderDisplayName === BOT_DISPLAY_NAME) {
    console.log('Skipping bot/self message', { senderDisplayName, id: event.id })
    return
  }
  if (messageType && messageType.toLowerCase() !== 'text') {
    console.info('Skipping non-text ACS message', { messageType })
    return
  }

  const reply = await streamBackendReply(messageBody as string)
  if (!reply) {
    console.warn('No reply generated for ACS message', { id: event.id })
    return
  }

  try {
    const { token, userId } = await getBotIdentity()
    console.log('Sending bot reply', { threadId, userId })
    const endpoint = extractEndpointFromConnectionString(CONNECTION_STRING)
    const chatClient = new ChatClient(endpoint, new AzureCommunicationTokenCredential(token))
    const threadClient = chatClient.getChatThreadClient(threadId)
    await threadClient.sendMessage({ content: `${BOT_PREFIX} ${reply}` }, { senderDisplayName: BOT_DISPLAY_NAME })
    console.info('Posted bot reply', { threadId, userId })
  } catch (error) {
    console.error('Failed to post bot reply to ACS', error)
  }
}

function extractMessageBody(data: EventGridEnvelope['data']): string | null {
  if (!data) return null
  const body = (data as { messageBody?: unknown; message?: unknown; body?: unknown }).messageBody ?? data.message ?? (data as { body?: unknown }).body
  if (typeof body === 'string') return body
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message
    const content = (body as { content?: unknown }).content
    const plainText = (body as { plainText?: unknown }).plainText
    const text = (body as { text?: unknown }).text
    if (typeof message === 'string') return message
    if (typeof content === 'string') return content
    if (typeof plainText === 'string') return plainText
    if (typeof text === 'string') return text
  }
  if (body) return String(body)
  return null
}

async function streamBackendReply(userContent: string): Promise<string | null> {
  try {
    const res = await fetch(STREAM_URL, {
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
        if (chunk) {
          assembled += chunk
        }
      }
    }

    return assembled.trim() || null
  } catch (error) {
    console.error('Failed streaming backend reply', error)
    return null
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
      if ('run_id' in (parsed as Record<string, unknown>)) return null
      const maybeContent = (parsed as { content?: unknown }).content
      const maybeText = (parsed as { text?: unknown }).text
      if (typeof maybeContent === 'string') return maybeContent
      if (typeof maybeText === 'string') return maybeText
    }
  } catch {
    // fall through
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return null
  return trimmed
}

async function fetchMessageBodyFromThread(threadId?: string, messageId?: string): Promise<string | null> {
  if (!threadId || !messageId || !CONNECTION_STRING) return null

  const { token } = await getBotIdentity()
  const endpoint = extractEndpointFromConnectionString(CONNECTION_STRING)
  const chatClient = new ChatClient(endpoint, new AzureCommunicationTokenCredential(token))
  const threadClient = chatClient.getChatThreadClient(threadId)

  try {
    const message = await threadClient.getMessage(messageId)
    return extractContentFromChatMessage(message) ?? null
  } catch (error) {
    console.warn('Failed to fetch message body from thread', { threadId, messageId, error })
    return null
  }
}

function extractContentFromChatMessage(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') return undefined
  const content = (message as { content?: unknown }).content
  if (!content || typeof content !== 'object') return undefined
  const msg = (content as { message?: unknown }).message
  const plain = (content as { plainText?: unknown }).plainText
  const text = (content as { text?: unknown }).text
  if (typeof msg === 'string') return msg
  if (typeof plain === 'string') return plain
  if (typeof text === 'string') return text
}

async function getBotIdentity(): Promise<CachedBotIdentity> {
  if (!CONNECTION_STRING) {
    throw new Error('NEXT_ACS_CONNECTION_STRING is required')
  }

  const now = Date.now()
  if (cachedBotIdentity && cachedBotIdentity.expiresOn.getTime() - now > 5 * 60 * 1000) {
    return cachedBotIdentity
  }

  const identityClient = new CommunicationIdentityClient(CONNECTION_STRING)
  const user = cachedBotIdentity
    ? { communicationUserId: cachedBotIdentity.userId }
    : await identityClient.createUser()
  const { token, expiresOn } = await identityClient.getToken(user, ['chat'])
  cachedBotIdentity = { userId: user.communicationUserId, token, expiresOn }
  return cachedBotIdentity
}

function extractEndpointFromConnectionString(connectionString: string): string {
  const parts = connectionString.split(';').filter(Boolean)
  for (const part of parts) {
    const [key, ...rest] = part.split('=')
    if (key.trim().toLowerCase() === 'endpoint') {
      return rest.join('=')
    }
  }
  throw new Error('Connection string missing endpoint')
}

function extractValidationCode(payload: unknown, aegEventType: string | null): string | undefined {
  if (aegEventType === 'SubscriptionValidation' || aegEventType === 'UnsubscribeValidation') {
    const events = normalizeEvents(payload)
    return events[0]?.data?.validationCode
  }

  // CloudEvents schema (no aeg-event-type header)
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload)) {
      const first = payload[0] as EventGridEnvelope | undefined
      if (first?.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
        return first.data?.validationCode
      }
    } else {
      const single = payload as EventGridEnvelope
      if (single.type === 'Microsoft.EventGrid.SubscriptionValidationEvent') {
        return single.data?.validationCode
      }
    }
  }
}

function normalizeEvents(payload: unknown): EventGridEnvelope[] {
  if (!payload) return []
  if (Array.isArray(payload)) {
    return payload as EventGridEnvelope[]
  }
  if (typeof payload === 'object') {
    return [payload as EventGridEnvelope]
  }
  return []
}

export const dynamic = 'force-dynamic'
