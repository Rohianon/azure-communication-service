import { randomUUID } from 'crypto'

import { AzureKeyCredential } from '@azure/core-auth'
import { EventGridPublisherClient } from '@azure/eventgrid'

import { getEventGridTopicEndpoint, getEventGridTopicKey } from '@/lib/services/azureEnvironment'

export const AI_USER_MESSAGE_EVENT = 'Mesh.AiChat.UserMessage'
export const AI_ASSISTANT_RESPONSE_EVENT = 'Mesh.AiChat.AssistantResponse'

type UserMessagePayload = {
  senderUserId: string
  messageText: string
  phoneNumber?: string
}

let publisher: EventGridPublisherClient<'EventGrid'> | null = null

function getPublisher(): EventGridPublisherClient<'EventGrid'> {
  if (!publisher) {
    publisher = new EventGridPublisherClient(
      getEventGridTopicEndpoint(),
      'EventGrid',
      new AzureKeyCredential(getEventGridTopicKey())
    )
  }
  return publisher
}

export async function publishAiUserMessageEvent(payload: UserMessagePayload) {
  const client = getPublisher()
  await client.send([
    {
      eventType: AI_USER_MESSAGE_EVENT,
      subject: `ai-chat/${payload.senderUserId}`,
      dataVersion: '1.0',
      data: payload,
      id: randomUUID(),
      eventTime: new Date(),
      topic: ''
    }
  ])
}
