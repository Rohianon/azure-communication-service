"use client"

import {
  ChatComposite,
  FluentThemeProvider,
  fromFlatCommunicationIdentifier,
  useAzureCommunicationChatAdapter
} from '@azure/communication-react'
import { AzureCommunicationTokenCredential, CommunicationUserIdentifier } from '@azure/communication-common'
import { useEffect, useMemo, useState } from 'react'

import { useAiResponderBridge, useAutoReadReceipts } from '@/lib/hooks/chatInstrumentation'
import type { AzureChatCredentials, ChatThreadMode } from '@/lib/types/chat'

type Props = {
  config: AzureChatCredentials
  threadId: string
  mode: ChatThreadMode
  userId: string
  phoneNumber?: string | null
}

export default function ConversationSurface({ config, threadId, mode, userId, phoneNumber }: Props) {
  const credential = useMemo(() => new AzureCommunicationTokenCredential(config.token), [config.token])

  const adapterArgs = useMemo(
    () => ({
      endpoint: config.endpointUrl,
      userId: fromFlatCommunicationIdentifier(config.userId),
      displayName: config.displayName,
      credential,
      threadId: config.threadId
    }),
    [config, credential]
  )

  const adapter = useAzureCommunicationChatAdapter({
    ...adapterArgs,
    userId: adapterArgs.userId as CommunicationUserIdentifier
  })

  useAutoReadReceipts(adapter, config.userId)
  useAiResponderBridge(adapter, {
    threadId,
    threadMode: mode,
    currentUserAcsId: config.userId,
    currentUserId: userId,
    currentUserPhoneNumber: phoneNumber ?? null
  })

  const [formFactor, setFormFactor] = useState<'mobile' | 'desktop'>(() =>
    typeof window === 'undefined' ? 'desktop' : window.innerWidth < 768 ? 'mobile' : 'desktop'
  )

  useEffect(() => {
    const updateFormFactor = () => {
      setFormFactor(window.innerWidth < 768 ? 'mobile' : 'desktop')
    }
    updateFormFactor()
    window.addEventListener('resize', updateFormFactor)
    return () => window.removeEventListener('resize', updateFormFactor)
  }, [])

  if (!adapter) {
    return <div className="rounded-xl bg-slate-900/60 p-6 text-sm text-slate-300">Connecting to Azure Communication Services…</div>
  }

  return (
    <div className="h-[90vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-white shadow-sm">
      <FluentThemeProvider>
        <div className="h-full w-full flex flex-col">
            <ChatComposite
            adapter={adapter}
            formFactor={formFactor}
            options={{
                autoFocus: 'sendBoxTextField',
                participantPane: false,
                topic: true,
                richTextEditor: false
            }}
            />
        </div>
      </FluentThemeProvider>
    </div>
  )
}