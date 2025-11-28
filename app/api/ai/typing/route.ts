import { NextResponse } from 'next/server'

import { sendAssistantTypingIndicator } from '@/lib/services/chatOrchestrator'

type Payload = {
  receiverUserId?: string
  threadId?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Payload | null
  if (!body?.receiverUserId) {
    return NextResponse.json({ error: 'receiverUserId is required' }, { status: 400 })
  }

  try {
    await sendAssistantTypingIndicator(body.receiverUserId, body.threadId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send typing indicator'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
