import { NextResponse } from 'next/server'

import { AI_ASSISTANT_RESPONSE_EVENT } from '@/lib/services/aiEventBridge'
import { deliverAssistantResponse } from '@/lib/services/chatOrchestrator'
import { type AdaptiveCardContent } from '@/lib/constants/adaptiveCards'

type EventGridEvent<T> = {
  id: string
  eventType: string
  subject?: string
  data?: T
  dataVersion: string
}

type SubscriptionValidationEvent = {
  validationCode?: string
}

type AiResponseEventData = {
  receiverUserId?: string
  messageText?: string
  adaptiveCard?: AdaptiveCardContent
}

export async function POST(request: Request) {
  const events = (await request.json().catch(() => null)) as Array<EventGridEvent<unknown>> | null

  if (!Array.isArray(events) || !events.length) {
    return NextResponse.json({ error: 'No events provided' }, { status: 400 })
  }

  const validationEvent = events.find((event) => event.eventType === 'Microsoft.EventGrid.SubscriptionValidationEvent')
  if (validationEvent) {
    const data = validationEvent.data as SubscriptionValidationEvent
    if (!data?.validationCode) {
      return NextResponse.json({ error: 'Missing validation code' }, { status: 400 })
    }
    return NextResponse.json({ validationResponse: data.validationCode })
  }

  const aiEvents = events.filter((event) => event.eventType === AI_ASSISTANT_RESPONSE_EVENT)
  if (!aiEvents.length) {
    return NextResponse.json({ processed: 0 })
  }

  const results = await Promise.allSettled(
    aiEvents.map(async (event) => {
      const data = event.data as AiResponseEventData
      if (!data?.receiverUserId || (!data.messageText && !data.adaptiveCard)) {
        throw new Error(`Event ${event.id} missing receiverUserId or message payload`)
      }
      await deliverAssistantResponse(data.receiverUserId, data.messageText ?? null, data.adaptiveCard)
    })
  )

  const failed = results.filter((result) => result.status === 'rejected')
  if (failed.length) {
    return NextResponse.json(
      {
        error: 'One or more AI response events failed',
        failures: failed.length
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ processed: aiEvents.length })
}
