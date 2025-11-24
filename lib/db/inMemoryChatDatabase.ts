import { randomUUID } from 'crypto'

import { AI_ASSISTANT_USER, HARD_CODED_USERS } from '@/lib/constants/users'
import type { ChatThread, ChatUser } from '@/lib/types/chat'

import type { ChatDatabase } from './chatDatabase'

function now(): Date {
  return new Date()
}

const humanSeed: ChatUser[] = HARD_CODED_USERS.map((user) => ({
  id: user.id,
  displayName: user.displayName,
  role: 'human',
  accentColor: user.accentColor,
  presence: user.presence,
  createdAt: now(),
  lastSeenAt: now()
}))

const assistantSeed: ChatUser = {
  ...AI_ASSISTANT_USER,
  createdAt: now(),
  lastSeenAt: now()
}

export class InMemoryChatDatabase implements ChatDatabase {
  private users = new Map<string, ChatUser>()
  private threads = new Map<string, ChatThread>()
  private participantIndex = new Map<string, string>()

  constructor() {
    ;[...humanSeed, assistantSeed].forEach((user) => {
      this.users.set(user.id, user)
    })
  }

  async listUsers(): Promise<ChatUser[]> {
    return Array.from(this.users.values())
  }

  async listHumanUsers(): Promise<ChatUser[]> {
    return Array.from(this.users.values()).filter((user) => user.role === 'human')
  }

  async getUser(userId: string): Promise<ChatUser | undefined> {
    return this.users.get(userId)
  }

  async saveUser(user: ChatUser): Promise<void> {
    this.users.set(user.id, user)
  }

  async listThreads(): Promise<ChatThread[]> {
    return Array.from(this.threads.values())
  }

  async listThreadsForUser(userId: string): Promise<ChatThread[]> {
    return Array.from(this.threads.values()).filter((thread) => thread.participantIds.includes(userId))
  }

  async getThread(threadId: string): Promise<ChatThread | undefined> {
    return this.threads.get(threadId)
  }

  async getThreadByParticipants(participantIds: string[]): Promise<ChatThread | undefined> {
    const key = this.getParticipantKey(participantIds)
    const threadId = this.participantIndex.get(key)
    if (!threadId) return undefined
    return this.threads.get(threadId)
  }

  async saveThread(thread: ChatThread): Promise<void> {
    const id = thread.id || randomUUID()
    const normalizedThread = { ...thread, id }
    this.threads.set(id, normalizedThread)
    this.participantIndex.set(this.getParticipantKey(thread.participantIds), id)
  }

  private getParticipantKey(participantIds: string[]): string {
    return participantIds.slice().sort().join('|')
  }
}
