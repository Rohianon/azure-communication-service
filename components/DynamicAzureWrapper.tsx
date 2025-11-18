"use client"

import dynamic from 'next/dynamic'

import type { AzureChatConfig } from '@/lib/azureCommunication'

const AzureCommunicationApp = dynamic(() => import('./AzureCommunicationApp'), {
  ssr: false,
  loading: () => <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading Azure components...</div>
})

type DynamicAzureWrapperProps = {
  config: AzureChatConfig
}

export default function DynamicAzureWrapper({ config }: DynamicAzureWrapperProps) {
  return <AzureCommunicationApp config={config} />
}
