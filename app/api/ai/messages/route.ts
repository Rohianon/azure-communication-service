import { NextResponse } from 'next/server'

import { publishAiUserMessageEvent } from '@/lib/services/aiEventBridge'

type Payload = {
  senderUserId: string
  messageText: string
  phoneNumber?: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Payload | null
  if (!body?.senderUserId || !body?.messageText) {
    return NextResponse.json({ error: 'senderUserId and messageText are required' }, { status: 400 })
  }

  try {
    await publishAiUserMessageEvent({
      senderUserId: body.senderUserId,
      messageText: body.messageText,
      phoneNumber: body.phoneNumber
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to publish AI message'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
