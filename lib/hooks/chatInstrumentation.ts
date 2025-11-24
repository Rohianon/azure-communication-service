"use client"

import type { ChatAdapter } from '@azure/communication-react'
import { useEffect, useRef } from 'react'

type Adapter = Pick<ChatAdapter, 'on' | 'off' | 'sendReadReceipt'>

type AiBridgeOptions = {
  threadId: string | null
  threadMode: 'user' | 'ai' | null
  currentUserAcsId: string | null
  currentUserId: string | null
}

export function useAutoReadReceipts(adapter: Adapter | undefined, currentUserAcsId: string | null) {
  useEffect(() => {
    if (!adapter || !adapter.sendReadReceipt || !currentUserAcsId) return

    const handler = (event: { message?: { id?: string; sender?: { rawId?: string; communicationUserId?: string } } }) => {
      const message = event.message
      if (!message?.id) return
      const senderId = message.sender?.communicationUserId ?? message.sender?.rawId
      if (senderId === currentUserAcsId) return
      adapter
        .sendReadReceipt?.(message.id)
        .catch((error) => console.warn('Failed to send read receipt', error))
    }

    adapter.on('messageReceived', handler)
    return () => {
      adapter.off('messageReceived', handler)
    }
  }, [adapter, currentUserAcsId])
}

export function useAiResponderBridge(adapter: Adapter | undefined, { threadId, threadMode, currentUserAcsId, currentUserId }: AiBridgeOptions) {
  const pendingRequests = useRef(new Set<string>())

  useEffect(() => {
    if (!adapter || threadMode !== 'ai' || !threadId || !currentUserAcsId || !currentUserId) {
      pendingRequests.current.clear()
      return
    }

    const trackedRequests = pendingRequests.current

    const handler = (event: { message?: { id?: string; content?: { message?: string }; sender?: { rawId?: string; communicationUserId?: string } } }) => {
      const message = event.message
      if (!message?.id) return
      const senderId = message.sender?.communicationUserId ?? message.sender?.rawId
      if (senderId && senderId !== currentUserAcsId) return

      if (trackedRequests.has(message.id)) return
      const text = message.content?.message ?? ''
      const trimmed = text.trim()
      if (!trimmed) return
      trackedRequests.add(message.id)

      fetch('/api/ai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderUserId: currentUserId, messageText: trimmed })
      }).catch((error) => {
        console.error('Failed to send AI response trigger', error)
      })
    }

    adapter.on('messageSent', handler)
    return () => {
      adapter.off('messageSent', handler)
      trackedRequests.clear()
    }
  }, [adapter, threadId, threadMode, currentUserAcsId, currentUserId])
}
