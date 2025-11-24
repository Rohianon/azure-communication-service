import { cache } from 'react'

let cachedEndpoint: string | null = null
let cachedEventGridEndpoint: string | null = null
let cachedEventGridKey: string | null = null

export const getConnectionString = cache(() => {
  const connectionString = process.env.NEXT_ACS_CONNECTION_STRING
  if (!connectionString) {
    throw new Error('NEXT_ACS_CONNECTION_STRING is not configured')
  }
  return connectionString
})

export const getEndpointUrl = cache(() => {
  if (cachedEndpoint) return cachedEndpoint
  const connectionString = getConnectionString()
  const parts = connectionString.split(';').filter(Boolean)
  for (const part of parts) {
    const [key, ...rest] = part.split('=')
    if (key.trim().toLowerCase() === 'endpoint') {
      cachedEndpoint = rest.join('=')
      return cachedEndpoint
    }
  }
  throw new Error('Connection string missing endpoint information')
})

export const getEventGridTopicEndpoint = cache(() => {
  if (cachedEventGridEndpoint) return cachedEventGridEndpoint
  const endpoint = process.env.NEXT_EVENT_GRID_TOPIC_ENDPOINT
  if (!endpoint) {
    throw new Error('NEXT_EVENT_GRID_TOPIC_ENDPOINT is not configured')
  }
  cachedEventGridEndpoint = endpoint
  return cachedEventGridEndpoint
})

export const getEventGridTopicKey = cache(() => {
  if (cachedEventGridKey) return cachedEventGridKey
  const key = process.env.NEXT_EVENT_GRID_TOPIC_KEY
  if (!key) {
    throw new Error('NEXT_EVENT_GRID_TOPIC_KEY is not configured')
  }
  cachedEventGridKey = key
  return cachedEventGridKey
})
