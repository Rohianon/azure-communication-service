import mintedAcsIdentities from './mintedAcsIdentities.json'
import type { PresenceStatus } from '../types/chat'

export type HardCodedUserDefinition = {
  id: string
  displayName: string
  accentColor: string
  presence: PresenceStatus
  externalId?: string
  acsIdentity?: string
}

const mintedIdentityMap = mintedAcsIdentities as Record<string, string | undefined>

const BASE_HARD_CODED_USERS: Omit<HardCodedUserDefinition, 'acsIdentity'>[] = [
  {
    id: 'fredrick',
    displayName: 'Fredrick Maina',
    accentColor: '#38BDF8',
    presence: 'online',
    externalId: '254743039297'
  },
  {
    id: 'assumpta',
    displayName: 'Assumpta Wanyama',
    accentColor: '#34D399',
    presence: 'online',
    externalId: '254736815546'
  },
  {
    id: 'rohi',
    displayName: 'Rohi Ogula',
    accentColor: '#F472B6',
    presence: 'away',
    externalId: '254799031228'
  },
  {
    id: 'guest',
    displayName: 'Guest',
    accentColor: '#A5B4FC',
    presence: 'offline'
  }
]

export const HARD_CODED_USERS: HardCodedUserDefinition[] = BASE_HARD_CODED_USERS.map((user) => ({
  ...user,
  acsIdentity: mintedIdentityMap[user.id]
}))

const BASE_AI_ASSISTANT_USER = {
  id: 'coach-mesh',
  displayName: 'Coach MESH',
  role: 'assistant' as const,
  accentColor: '#E879F9',
  acsIdentity: '8:acs:a46d38be-853b-45c8-a689-46e0cf9713e4_0000002b-5528-cc4c-2ea5-f4bd4560a05a',
  presence: 'online' as PresenceStatus
}

export const AI_ASSISTANT_USER = {
  ...BASE_AI_ASSISTANT_USER,
  acsIdentity: mintedIdentityMap[BASE_AI_ASSISTANT_USER.id]
}
