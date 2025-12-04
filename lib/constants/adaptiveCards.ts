export const ADAPTIVE_CARD_METADATA_KEY = 'microsoft.azure.communication.chat.bot.contenttype'
export const ADAPTIVE_CARD_METADATA_VALUE = 'azurebotservice.adaptivecard'

export type AdaptiveCardTextBlock = {
  type: 'TextBlock'
  text: string
  wrap?: boolean
}

export type AdaptiveCardButtonAction = {
  type: 'Action.Submit'
  title: string
  data?: Record<string, unknown>
}

export type AdaptiveCardOpenUrlAction = {
  type: 'Action.OpenUrl'
  title: string
  url: string
}

export type AdaptiveCardAction = AdaptiveCardButtonAction | AdaptiveCardOpenUrlAction

export type AdaptiveCardContent = {
  $schema?: 'http://adaptivecards.io/schemas/adaptive-card.json'
  type: 'AdaptiveCard'
  version: '1.6'
  body: AdaptiveCardTextBlock[]
  actions?: AdaptiveCardAction[]
}

export function buildButtonCard(message: string, buttons: AdaptiveCardButtonAction[]): AdaptiveCardContent {
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.6',
    body: [
      {
        type: 'TextBlock',
        text: message,
        wrap: true
      }
    ],
    actions: buttons
  }
}

export function buildOpenUrlCard(message: string, links: AdaptiveCardOpenUrlAction[]): AdaptiveCardContent {
  return {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.6',
    body: [
      {
        type: 'TextBlock',
        text: message,
        wrap: true
      }
    ],
    actions: links
  }
}

export function adaptiveCardPreview(card: AdaptiveCardContent): string {
  const primaryText = card.body.find((item) => item.type === 'TextBlock')?.text
  return primaryText ?? 'Adaptive card'
}
