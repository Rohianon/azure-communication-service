"use client"

import { useEffect, useRef } from 'react'
import type { ChatAdapter, MessageSentListener } from '@azure/communication-react'
import { getIdentifierRawId } from '@azure/communication-common'

import { triggerAiResponder, triggerAssistantTypingIndicator } from '@/lib/apiClient'

type MessageSentEvent = Parameters<MessageSentListener>[0]

type Adapter = Pick<ChatAdapter, 'on' | 'off' | 'sendReadReceipt'>

type AiBridgeOptions = {
  threadId: string | null
  threadMode: 'user' | 'ai' | null
  currentUserAcsId: string | null
  currentUserId: string | null
  currentUserPhoneNumber: string | null
}

export function useAutoReadReceipts(adapter: Adapter | undefined, currentUserAcsId: string | null) {
  useEffect(() => {
    if (!adapter || !adapter.sendReadReceipt || !currentUserAcsId) return

    const handler = (event: MessageSentEvent) => {
      const message = event.message
      if (!message?.id) return
      const senderId = message.sender ? getIdentifierRawId(message.sender) : null
      if (senderId === currentUserAcsId) return
      adapter
        .sendReadReceipt?.(message.id)
        .catch((error) => console.warn('Failed to send read receipt', error))
    }

    adapter.on('messageSent', handler)
    return () => {
      adapter.off('messageSent', handler)
    }
  }, [adapter, currentUserAcsId])
}

export function useAiResponderBridge(
  adapter: Adapter | undefined,
  { threadId, threadMode, currentUserAcsId, currentUserId, currentUserPhoneNumber }: AiBridgeOptions
) {
  const pendingRequests = useRef(new Set<string>())
  const normalizedPhoneNumber = currentUserPhoneNumber ?? null

  useEffect(() => {
    if (!adapter || threadMode !== 'ai' || !threadId || !currentUserAcsId || !currentUserId) {
      pendingRequests.current.clear()
      return
    }

    const trackedRequests = pendingRequests.current

    const handler = (event: MessageSentEvent) => {
      const message = event.message
      if (!message?.id) return
      const senderId = message.sender ? getIdentifierRawId(message.sender) : null
      if (senderId && senderId !== currentUserAcsId) return

      if (trackedRequests.has(message.id)) return
      const text = message.content?.message ?? ''
      const trimmed = text.trim()
      if (!trimmed) return
      trackedRequests.add(message.id)

      triggerAssistantTypingIndicator({
        receiverUserId: currentUserId,
        threadId
      }).catch((error) => {
        console.error('Failed to send assistant typing indicator trigger', error)
      })

      triggerAiResponder({
        senderUserId: currentUserId,
        phoneNumber: normalizedPhoneNumber ?? undefined,
        messageText: trimmed
      }).catch((error) => {
        console.error('Failed to send AI response trigger', error)
      })
    }

    adapter.on('messageSent', handler)
    return () => {
      adapter.off('messageSent', handler)
      trackedRequests.clear()
    }
  }, [adapter, threadId, threadMode, currentUserAcsId, currentUserId, normalizedPhoneNumber])
}
