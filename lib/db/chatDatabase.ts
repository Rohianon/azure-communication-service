import type { ChatThread, ChatUser } from '@/lib/types/chat'

export interface ChatDatabase {
  listUsers(): Promise<ChatUser[]>
  listHumanUsers(): Promise<ChatUser[]>
  getUser(userId: string): Promise<ChatUser | undefined>
  saveUser(user: ChatUser): Promise<void>

  listThreads(): Promise<ChatThread[]>
  listThreadsForUser(userId: string): Promise<ChatThread[]>
  getThread(threadId: string): Promise<ChatThread | undefined>
  getThreadByParticipants(participantIds: string[]): Promise<ChatThread | undefined>
  saveThread(thread: ChatThread): Promise<void>
}
