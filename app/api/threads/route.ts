import { NextResponse } from 'next/server'

import { getChatCredentialsForThread, startAiConversation, startUserConversation } from '@/lib/services/chatOrchestrator'
import { serializeThread } from '@/lib/utils/serialization'

type CreateThreadPayload = {
  initiatorId: string
  peerId?: string
  mode: 'user' | 'ai'
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateThreadPayload | null
  if (!body?.initiatorId || !body?.mode) {
    return NextResponse.json({ error: 'initiatorId and mode are required' }, { status: 400 })
  }

  try {
    const thread =
      body.mode === 'ai'
        ? await startAiConversation(body.initiatorId)
        : await startUserConversation(body.initiatorId, body.peerId ?? '')
    const config = await getChatCredentialsForThread(body.initiatorId, thread.id)
    return NextResponse.json({
      thread: serializeThread(thread),
      config
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create thread'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
