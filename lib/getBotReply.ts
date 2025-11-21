export async function getBotReply(message: string) {
  const normalizedMessage = message.trim()

  const response = await fetch('https://gf-mesh-backend-copy-production.up.railway.app/azure/chat/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([
      {
        eventType: 'Microsoft.Communication.ChatMessageReceived',
        data: {
          message: {
            content: normalizedMessage
          }
        }
      }
    ])
  })

  if (!response.ok) {
    throw new Error(`Bot reply request failed with status ${response.status}`)
  }

  const payload = await response.json().catch(() => null)
  const normalized = Array.isArray(payload) ? payload[0] : payload
  const reply = typeof normalized?.response === 'string' ? normalized.response : ''
  return reply
}
