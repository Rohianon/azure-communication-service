export type UserRole = 'human' | 'assistant'

export type PresenceStatus = 'online' | 'offline' | 'away'

export interface ChatUser {
  id: string
  displayName: string
  role: UserRole
  accentColor: string
  acsIdentity?: string
  presence: PresenceStatus
  createdAt: Date
  lastSeenAt: Date
}

export type ChatThreadMode = 'user' | 'ai'

export interface ChatThread {
  id: string
  acsThreadId: string
  mode: ChatThreadMode
  topic: string
  participantIds: string[]
  createdAt: Date
  lastActivityAt: Date
  lastMessagePreview?: string
}

export interface AzureChatCredentials {
  userId: string
  displayName: string
  endpointUrl: string
  token: string
  threadId: string
  topic: string
}

export interface ThreadListItem extends ChatThread {
  unreadCount: number
}

export interface AiAssistantProfile {
  id: string
  displayName: string
  tagline: string
  persona: string
  acsIdentity?: string
}
