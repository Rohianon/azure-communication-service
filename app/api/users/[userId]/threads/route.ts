import { NextResponse } from 'next/server'

import { listThreadsForUser } from '@/lib/services/chatOrchestrator'
import { serializeThread } from '@/lib/utils/serialization'

type RouteContext = {
  params: Promise<{
    userId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params
  const threads = await listThreadsForUser(params.userId)
  return NextResponse.json({
    threads: threads.map(serializeThread)
  })
}
