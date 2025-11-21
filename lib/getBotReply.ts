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

  const data = (await response.json().catch(() => null)) as { response?: string } | null
  const reply = typeof data?.response === 'string' ? data.response : ''
  return reply
}
