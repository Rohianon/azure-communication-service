import * as dotenv from 'dotenv'
import { ChatClient } from '@azure/communication-chat'
import {
  AzureCommunicationTokenCredential,
  createIdentifierFromRawId
} from '@azure/communication-common'
import { CommunicationIdentityClient } from '@azure/communication-identity'

dotenv.config()

export type AzureChatConfig = {
  endpointUrl: string
  userId: string
  token: string
  displayName: string
  threadId: string
}

const DEFAULT_TOPIC = 'MVP'
const CONNECTION_STRING_ENV = 'NEXT_ACS_CONNECTION_STRING'

function getDisplayName(): string {
  return process.env.NEXT_PUBLIC_ACS_DISPLAY_NAME ?? 'Coach MESH'
}

function getTopic(): string {
  return process.env.AZURE_COMMUNICATION_TOPIC ?? DEFAULT_TOPIC
}

function extractEndpointFromConnectionString(connectionString: string): string {
  const parts = connectionString.split(';').filter(Boolean)
  for (const part of parts) {
    const [key, ...rest] = part.split('=')
    if (key.trim().toLowerCase() === 'endpoint') {
      return rest.join('=')
    }
  }
  throw new Error('Connection string missing endpoint')
}

/**
 * Fetches chat configuration on the server so we can
 * keep credentials off the client and leverage SSR.
 * Mints from the ACS connection string; no legacy static token path.
 */
export async function getAzureChatConfig(): Promise<AzureChatConfig> {
  const connectionString = process.env[CONNECTION_STRING_ENV]
  if (!connectionString) {
    throw new Error(`Missing required environment variable ${CONNECTION_STRING_ENV}`)
  }
  return buildConfigFromConnectionString(connectionString)
}

async function buildConfigFromConnectionString(connectionString: string): Promise<AzureChatConfig> {
  const identityClient = new CommunicationIdentityClient(connectionString)
  const endpointUrl = extractEndpointFromConnectionString(connectionString)
  const displayName = getDisplayName()

  const user = await identityClient.createUser()
  const { token, expiresOn } = await identityClient.getToken(user, ['chat', 'voip'])
  console.log('Minted ACS user token', { expiresOn })

  const chatClient = new ChatClient(endpointUrl, new AzureCommunicationTokenCredential(token))
  const threadId =
    process.env.AZURE_COMMUNICATION_THREAD_ID ??
    (await createThread(endpointUrl, token, user.communicationUserId, displayName, chatClient))

  return {
    endpointUrl,
    userId: user.communicationUserId,
    token,
    displayName,
    threadId
  }
}

async function createThread(
  endpointUrl: string,
  token: string,
  userId: string,
  displayName: string,
  chatClientFromConnectionString?: ChatClient
): Promise<string> {
  const participantId = createIdentifierFromRawId(userId)
  const chatClient = chatClientFromConnectionString ?? new ChatClient(endpointUrl, new AzureCommunicationTokenCredential(token))

  const { chatThread } = await chatClient.createChatThread(
    { topic: getTopic() },
    {
      participants: [
        {
          id: participantId,
          displayName
        }
      ]
    }
  )

  return chatThread?.id ?? ''
}
