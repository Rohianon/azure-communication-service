import type { PresenceStatus } from '@/lib/types/chat'

export type HardCodedUserDefinition = {
  id: string
  displayName: string
  accentColor: string
  presence: PresenceStatus
}

export const HARD_CODED_USERS: HardCodedUserDefinition[] = [
  {
    id: 'fredrick',
    displayName: 'Fredrick Maina',
    accentColor: '#38BDF8',
    presence: 'online'
  },
  {
    id: 'assumpta',
    displayName: 'Assumpta Wanmyama',
    accentColor: '#34D399',
    presence: 'online'
  },
  {
    id: 'rohi',
    displayName: 'Rohi Ogula',
    accentColor: '#F472B6',
    presence: 'away'
  },
  {
    id: 'guest',
    displayName: 'Guest',
    accentColor: '#A5B4FC',
    presence: 'offline'
  }
]

export const AI_ASSISTANT_USER = {
  id: 'coach-mesh',
  displayName: 'Coach MESH',
  role: 'assistant' as const,
  accentColor: '#E879F9',
  presence: 'online' as PresenceStatus
}
