"use client"

import {
  type AzureCommunicationChatAdapterArgs,
  type ChatAdapter,
  type ChatAdapterOptions,
  createAzureCommunicationChatAdapter
} from '@azure/communication-react'
import { useEffect, useRef, useState } from 'react'

export type AdaptiveCardsChatAdapterOptions = ChatAdapterOptions & {
  enableAdaptiveCards?: boolean
}

type AdapterArgsWithOptions = Omit<AzureCommunicationChatAdapterArgs, 'chatAdapterOptions'> & {
  chatAdapterOptions?: AdaptiveCardsChatAdapterOptions
}

/**
 * A small wrapper around the stock hook that forwards {@link chatAdapterOptions},
 * which we need to enable Adaptive Cards.
 */
export function useChatAdapterWithOptions(
  args: Partial<AdapterArgsWithOptions>,
  afterCreate?: (adapter: ChatAdapter) => Promise<ChatAdapter>,
  beforeDispose?: (adapter: ChatAdapter) => Promise<void>
): ChatAdapter | undefined {
  const { credential, displayName, endpoint, threadId, userId, chatAdapterOptions } = args
  const [adapter, setAdapter] = useState<ChatAdapter | undefined>(undefined)
  const adapterRef = useRef<ChatAdapter | undefined>(undefined)
  const creatingAdapterRef = useRef(false)
  const afterCreateRef = useRef(afterCreate)
  const beforeDisposeRef = useRef(beforeDispose)

  useEffect(() => {
    afterCreateRef.current = afterCreate
    beforeDisposeRef.current = beforeDispose
  }, [afterCreate, beforeDispose])

  useEffect(() => {
    if (!credential || !displayName || !endpoint || !threadId || !userId) {
      return
    }

    ;(async () => {
      if (adapterRef.current) {
        if (beforeDisposeRef.current) {
          await beforeDisposeRef.current(adapterRef.current)
        }
        adapterRef.current.dispose()
        adapterRef.current = undefined
      }

      if (creatingAdapterRef.current) {
        console.warn(
          'Adapter is already being created, please see storybook for more information: https://azure.github.io/communication-ui-library/?path=/story/troubleshooting--page'
        )
        return
      }

      creatingAdapterRef.current = true
      let newAdapter = await createAzureCommunicationChatAdapter({
        credential,
        displayName,
        endpoint,
        threadId,
        userId,
        // The SDK type is narrow; cast to allow experimental flags like enableAdaptiveCards.
        chatAdapterOptions: chatAdapterOptions as ChatAdapterOptions
      })

      if (afterCreateRef.current) {
        newAdapter = await afterCreateRef.current(newAdapter)
      }

      adapterRef.current = newAdapter
      creatingAdapterRef.current = false
      setAdapter(newAdapter)
    })()
  }, [credential, displayName, endpoint, threadId, userId, chatAdapterOptions])

  useEffect(() => {
    return () => {
      ;(async () => {
        if (adapterRef.current) {
          if (beforeDisposeRef.current) {
            await beforeDisposeRef.current(adapterRef.current)
          }
          adapterRef.current.dispose()
          adapterRef.current = undefined
        }
      })()
    }
  }, [])

  return adapter
}
