import { NextResponse } from 'next/server'

import { getAssistantProfile, listHumanUsers } from '@/lib/services/chatOrchestrator'
import { serializeUser } from '@/lib/utils/serialization'

export async function GET() {
  const [users, assistant] = await Promise.all([listHumanUsers(), getAssistantProfile()])
  return NextResponse.json({
    users: users.map(serializeUser),
    assistant
  })
}
