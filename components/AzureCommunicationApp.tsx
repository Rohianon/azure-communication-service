"use client"

import { AzureCommunicationTokenCredential } from '@azure/communication-common'
import { ChatComposite, fromFlatCommunicationIdentifier, useAzureCommunicationChatAdapter } from '@azure/communication-react'
import { initializeIcons } from '@fluentui/react'
import { CSSProperties, useMemo, useRef } from 'react'

import type { AzureChatConfig } from '@/lib/azureCommunication'
import {
  renderBotOnLeft,
  useBotStreaming,
  useReadReceipts,
  useTypingIndicator,
  useWelcomeMessage
} from '@/utils/azureChat'

const richTextEditorEnabled = false

initializeIcons()

type AzureCommunicationAppProps = {
  config: AzureChatConfig
}

export default function AzureCommunicationApp({ config }: AzureCommunicationAppProps): JSX.Element {
  const { endpointUrl, userId, token, displayName, threadId } = config
  const welcomedRef = useRef(false)

  const credential = useMemo(() => {
    try {
      return new AzureCommunicationTokenCredential(token)
    } catch {
      console.error('Failed to construct token credential')
      return undefined
    }
  }, [token])

  const chatAdapterArgs = useMemo(
    () => ({
      endpoint: endpointUrl,
      userId: fromFlatCommunicationIdentifier(userId),
      displayName,
      credential,
      threadId
    }),
    [endpointUrl, userId, displayName, credential, threadId]
  )
  const chatAdapter = useAzureCommunicationChatAdapter(chatAdapterArgs)

  useBotStreaming(chatAdapter)
  useReadReceipts(chatAdapter, userId)
  useTypingIndicator(chatAdapter)
  useWelcomeMessage(chatAdapter, welcomedRef)

  if (!threadId) {
    return <h3>Chat thread is not configured.</h3>
  }
  if (credential === undefined) {
    return <h3>Failed to construct credential. Provided token is malformed.</h3>
  }
  if (!chatAdapter) {
    return <h3>Initializing...</h3>
  }

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      <div style={containerStyle}>
        <ChatComposite
          adapter={chatAdapter}
          options={{ richTextEditor: richTextEditorEnabled }}
          onRenderMessage={renderBotOnLeft}
        />
      </div>
    </div>
  )
}

const containerStyle: CSSProperties = {
  border: 'solid 0.125rem olive',
  margin: '0.5rem',
  width: '100vw'
}
