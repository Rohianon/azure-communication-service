import type { ChatThread, ThreadListItem, ChatUser } from '@/lib/types/chat'

export function serializeUser(user: ChatUser) {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    lastSeenAt: user.lastSeenAt.toISOString()
  }
}

export function serializeThread(thread: ThreadListItem | ChatThread) {
  return {
    ...thread,
    createdAt: thread.createdAt.toISOString(),
    lastActivityAt: thread.lastActivityAt.toISOString()
  }
}
