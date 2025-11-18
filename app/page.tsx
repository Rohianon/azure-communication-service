import DynamicAzureWrapper from '@/components/DynamicAzureWrapper'
import { getAzureChatConfig } from '@/lib/azureCommunication'
import type { AzureChatConfig } from '@/lib/azureCommunication'

export default async function Home() {
  let chatConfig: AzureChatConfig | null = null
  let errorMessage: string | null = null

  try {
    chatConfig = await getAzureChatConfig()
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unable to load chat configuration.'
  }

  if (!chatConfig) {
    return <div style={{ padding: '2rem' }}>Failed to initialize chat: {errorMessage}</div>
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <main>
        <DynamicAzureWrapper config={chatConfig} />
      </main>
    </div>
  )
}
