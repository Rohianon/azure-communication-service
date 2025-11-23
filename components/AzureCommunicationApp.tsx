"use client"

import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'

import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common'
import { ChatComposite, CompositeLocale, fromFlatCommunicationIdentifier, useAzureCommunicationChatAdapter } from '@azure/communication-react'
import { initializeIcons } from '@fluentui/react'
import { PartialTheme, Theme } from '@fluentui/react'

import type { AzureChatConfig } from '@/lib/azureCommunication'
import { renderBotOnLeft, useBotReplies, useReadReceipts, useTypingIndicator, useWelcomeMessage } from '@/lib/azureChat'
import { PeopleButton } from './PeopleButton'

initializeIcons()

type AzureCommunicationAppProps = {
  config: AzureChatConfig
}

type ContainerProps = {
  fluentTheme?: PartialTheme | Theme
  rtl?: boolean
  errorBar?: boolean
  participants?: boolean
  topic?: boolean
  locale?: CompositeLocale
  formFactor?: 'desktop' | 'mobile'
  richTextEditor?: boolean
}

type Props = AzureCommunicationAppProps & ContainerProps

export default function AzureCommunicationApp({ config, ...uiProps }: Props): JSX.Element {
  const welcomedRef = useRef(false)

  const credential = useMemo(() => {
    try {
      return new AzureCommunicationTokenCredential(config.token)
    } catch {
      console.error('Failed to construct token credential')
      return undefined
    }
  }, [config.token])

  const userId = useMemo(
    () => fromFlatCommunicationIdentifier(config.userId) as CommunicationUserIdentifier,
    [config.userId]
  )

  // Add throttling for setting display name during typing
  const [displayName, setDisplayName] = useState<string | undefined>(undefined)
  useEffect(() => {
    const handle = setTimeout(() => {
      setDisplayName(config.displayName)
    }, 500)
    return () => clearTimeout(handle)
  }, [config.displayName])
  
  const chatAdapterArgs = {
    endpoint: config.endpointUrl,
    userId: userId,
    displayName,
    credential,
    threadId: config.threadId
  }
  const chatAdapter = useAzureCommunicationChatAdapter(chatAdapterArgs)

  useReadReceipts(chatAdapter, config.userId)
  useTypingIndicator(chatAdapter)
  useBotReplies(chatAdapter)
  useWelcomeMessage(chatAdapter, welcomedRef)

  if (!config.threadId) {
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
          rtl={uiProps.rtl ?? false}
          fluentTheme={uiProps.fluentTheme}
          options={{ 
            errorBar: uiProps.errorBar,
            participantPane: uiProps.participants,
            topic: uiProps.topic,
            richTextEditor: uiProps.richTextEditor }}
          onRenderMessage={renderBotOnLeft}
          locale={uiProps.locale}
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
