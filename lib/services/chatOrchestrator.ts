import { randomUUID } from 'crypto'

import { ChatClient } from '@azure/communication-chat'
import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common'
import { CommunicationIdentityClient } from '@azure/communication-identity'

import { getDatabase } from '@/lib/db/provider'
import type {
  AiAssistantProfile,
  AzureChatCredentials,
  ChatThread,
  ChatThreadMode,
  ChatUser,
  ThreadListItem
} from '@/lib/types/chat'

import { getConnectionString, getEndpointUrl } from './azureEnvironment'

const identityClient = new CommunicationIdentityClient(getConnectionString())
const endpointUrl = getEndpointUrl()
const ASSISTANT_TAGLINE = 'Always-on finance guide'

function createChatClient(token: string): ChatClient {
  return new ChatClient(endpointUrl, new AzureCommunicationTokenCredential(token))
}

async function ensureUserIdentity(user: ChatUser): Promise<ChatUser> {
  if (user.acsIdentity) {
    return user
  }

  const identity = await identityClient.createUser()
  const updatedUser: ChatUser = {
    ...user,
    acsIdentity: identity.communicationUserId,
    lastSeenAt: new Date()
  }
  await getDatabase().saveUser(updatedUser)
  return updatedUser
}

async function issueToken(user: ChatUser): Promise<string> {
  const targetUser = await ensureUserIdentity(user)
  const { token } = await identityClient.getToken({ communicationUserId: targetUser.acsIdentity! }, ['chat'])
  await getDatabase().saveUser({
    ...targetUser,
    lastSeenAt: new Date()
  })
  return token
}

async function ensureThreadRecord(participantIds: string[], mode: ChatThreadMode, topic: string): Promise<ChatThread> {
  const db = getDatabase()
  const existingThread = await db.getThreadByParticipants(participantIds)
  if (existingThread) {
    return existingThread
  }

  const primaryUser = await db.getUser(participantIds[0])
  if (!primaryUser) {
    throw new Error('Initiator user not found')
  }

  const token = await issueToken(primaryUser)
  const chatClient = createChatClient(token)

  const participants = await Promise.all(
    participantIds.map(async (id) => {
      const user = await db.getUser(id)
      if (!user) {
        throw new Error(`Participant ${id} missing`)
      }
      const withIdentity = await ensureUserIdentity(user)
      return {
        id: { communicationUserId: withIdentity.acsIdentity! } as CommunicationUserIdentifier,
        displayName: withIdentity.displayName
      }
    })
  )

  const { chatThread } = await chatClient.createChatThread(
    { topic },
    {
      participants
    }
  )

  if (!chatThread?.id) {
    throw new Error('Failed to create chat thread in ACS')
  }

  const now = new Date()
  const thread: ChatThread = {
    id: randomUUID(),
    acsThreadId: chatThread.id,
    mode,
    topic,
    participantIds,
    createdAt: now,
    lastActivityAt: now,
    lastMessagePreview: 'Conversation started'
  }

  await db.saveThread(thread)

  return thread
}

type AssistantConversationContext = {
  human: ChatUser
  assistantProfile: AiAssistantProfile
  assistantRecord: ChatUser
  thread: ChatThread
}

async function ensureAssistantConversation(userId: string, threadId?: string): Promise<AssistantConversationContext> {
  const db = getDatabase()
  const human = await db.getUser(userId)
  if (!human) {
    throw new Error('User not found')
  }

  const assistantProfile = await getAssistantProfile()
  const assistantRecord = await db.getUser(assistantProfile.id)
  if (!assistantRecord) {
    throw new Error('Assistant user is missing from the database')
  }

  let thread: ChatThread | null = null
  if (threadId) {
    const existing = await db.getThread(threadId)
    if (
      existing &&
      existing.participantIds.includes(userId) &&
      existing.participantIds.includes(assistantProfile.id) &&
      existing.mode === 'ai'
    ) {
      thread = existing
    }
  }

  if (!thread) {
    thread =
      (await db.getThreadByParticipants([userId, assistantProfile.id])) ??
      (await ensureThreadRecord(
        [userId, assistantProfile.id],
        'ai',
        `${assistantProfile.displayName} with ${human.displayName.split(' ')[0]}`
      ))
  }

  return {
    human,
    assistantProfile,
    assistantRecord,
    thread
  }
}

export async function listHumanUsers() {
  const users = await getDatabase().listHumanUsers()
  return users.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function getAssistantProfile(): Promise<AiAssistantProfile> {
  const assistant = (await getDatabase().listUsers()).find((user) => user.role === 'assistant')
  if (!assistant) {
    throw new Error('Assistant profile missing from database')
  }
  const ensured = await ensureUserIdentity(assistant)
  return {
    id: ensured.id,
    displayName: ensured.displayName,
    tagline: ASSISTANT_TAGLINE,
    persona: 'Financial wellness coach',
    acsIdentity: ensured.acsIdentity
  }
}

export async function listThreadsForUser(userId: string): Promise<ThreadListItem[]> {
  const db = getDatabase()
  const threads = await db.listThreadsForUser(userId)
  return threads
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
    .map((thread) => ({
      ...thread,
      unreadCount: 0
    }))
}

export async function startUserConversation(initiatorId: string, peerId: string): Promise<ThreadListItem> {
  if (initiatorId === peerId) {
    throw new Error('Cannot start a thread with yourself')
  }
  const db = getDatabase()
  const initiator = await db.getUser(initiatorId)
  const peer = await db.getUser(peerId)
  if (!initiator || !peer) {
    throw new Error('Both users must exist to create a conversation')
  }
  if (peer.role !== 'human') {
    throw new Error('Peer must be a human user')
  }
  const topic = `${initiator.displayName.split(' ')[0]} ↔ ${peer.displayName.split(' ')[0]}`
  const thread = await ensureThreadRecord([initiatorId, peerId], 'user', topic)
  return { ...thread, unreadCount: 0 }
}

export async function startAiConversation(userId: string): Promise<ThreadListItem> {
  const assistant = await getAssistantProfile()
  const human = await getDatabase().getUser(userId)
  if (!human) {
    throw new Error('User not found')
  }
  const topic = `${assistant.displayName} with ${human.displayName.split(' ')[0]}`
  const thread = await ensureThreadRecord([userId, assistant.id], 'ai', topic)
  return { ...thread, unreadCount: 0 }
}

export async function getChatCredentialsForThread(userId: string, threadId: string): Promise<AzureChatCredentials> {
  const db = getDatabase()
  const user = await db.getUser(userId)
  if (!user) {
    throw new Error('User not found')
  }
  const thread = await db.getThread(threadId)
  if (!thread) {
    throw new Error('Thread not found')
  }
  if (!thread.participantIds.includes(userId)) {
    throw new Error('User is not part of this thread')
  }

  const token = await issueToken(user)
  const ensured = await ensureUserIdentity(user)

  return {
    userId: ensured.acsIdentity!,
    displayName: ensured.displayName,
    endpointUrl,
    token,
    threadId: thread.acsThreadId,
    topic: thread.topic
  }
}

export async function deliverAssistantResponse(userId: string, messageText: string): Promise<void> {
  const trimmed = messageText.trim()
  if (!trimmed) {
    return
  }

  const { assistantRecord, thread } = await ensureAssistantConversation(userId)
  const token = await issueToken(assistantRecord)
  const client = createChatClient(token)
  const threadClient = client.getChatThreadClient(thread.acsThreadId)

  await threadClient.sendTypingNotification().catch(() => undefined)

  await threadClient.sendMessage(
    {
      content: trimmed
    },
    {
      senderDisplayName: assistantRecord.displayName
    }
  )

  await getDatabase().saveThread({
    ...thread,
    lastActivityAt: new Date(),
    lastMessagePreview: trimmed.slice(0, 120)
  })
}

export async function sendAssistantTypingIndicator(userId: string, threadId?: string): Promise<void> {
  const { assistantRecord, thread } = await ensureAssistantConversation(userId, threadId)
  const token = await issueToken(assistantRecord)
  const client = createChatClient(token)
  const threadClient = client.getChatThreadClient(thread.acsThreadId)
  await threadClient.sendTypingNotification()
}
