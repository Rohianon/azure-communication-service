import { NextResponse } from 'next/server'

import { getChatCredentialsForThread } from '@/lib/services/chatOrchestrator'

type Payload = {
  userId: string
  threadId: string
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Payload | null
  if (!body?.userId || !body?.threadId) {
    return NextResponse.json({ error: 'userId and threadId are required' }, { status: 400 })
  }

  try {
    const config = await getChatCredentialsForThread(body.userId, body.threadId)
    return NextResponse.json({ config })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create chat adapter config'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
