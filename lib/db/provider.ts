import { InMemoryChatDatabase } from './inMemoryChatDatabase'
import type { ChatDatabase } from './chatDatabase'

declare global {
  var __CHAT_DB__: ChatDatabase | undefined
}

export function getDatabase(): ChatDatabase {
  if (!globalThis.__CHAT_DB__) {
    globalThis.__CHAT_DB__ = new InMemoryChatDatabase()
  }
  return globalThis.__CHAT_DB__
}
