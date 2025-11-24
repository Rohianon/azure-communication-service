# Azure Communication Service Workbench

Modern chat workspace that showcases Azure Communication Services (ACS) chat primitives with both human-to-human threads and a first-class AI coaching assistant.

## Features
- **Profile picker auth** – a full-screen modal lets you jump in as Fredrick, Rohi, Assumpta, or Guest with a single tap (no passwords) and persists your choice in local storage.
- **Mobile-first contacts + DM UX** – AI assistant is pinned above the human directory, with swipe-friendly cards, unread badges, and a full-height ACS chat surface that mirrors Mesh.life styling.
- **Azure Chat SDK integration** – message bubbles, typing indicators, read/delivered receipts, and attachment-ready surfaces powered by `@azure/communication-react`.
- **Event Grid AI bridge** – user-to-AI messages are published to Azure Event Grid and responses flow back as Event Grid deliveries before being injected into ACS, keeping all telemetry accurate without custom realtime stacks.
- **Mock database layer** – extensible in-memory repository stands in for Postgres/Mongo; all access goes through the `ChatDatabase` abstraction for easy replacement.
- **Event-safe orchestration** – services manage identity minting, thread provisioning, token issuance, and ACS message delivery from the assistant.

## Prerequisites
- Node.js 18+
- Bun ≥ 1.1 (`curl -fsSL https://bun.sh/install | bash`)
- An Azure Communication Services resource with Chat enabled

## Configuration
Create `.env.local` in the project root:

```env
NEXT_ACS_CONNECTION_STRING="endpoint=https://<resource>.communication.azure.com/;accesskey=<key>"
NEXT_EVENT_GRID_TOPIC_ENDPOINT="https://<event-grid-topic>.<region>-1.eventgrid.azure.net/api/events"
NEXT_EVENT_GRID_TOPIC_KEY="<topic-key>"
```

### AI Event Payloads
When a human sends a message inside the ACS UI, `/api/ai/messages` publishes a `Mesh.AiChat.UserMessage` event to Event Grid with the following shape:

```json
{
  "eventType": "Mesh.AiChat.UserMessage",
  "dataVersion": "1.0",
  "data": {
    "senderUserId": "fredrick",
    "phoneNumber": "254743039297",
    "messageText": "Hey coach, can we review my savings plan?"
  }
}
```

The `phoneNumber` is the WhatsApp-style identifier your existing backend expects. Current mappings are:

| Profile          | Phone number   |
| ---------------- | -------------- |
| Fredrick Maina   | `254743039297` |
| Assumpta Wanmyama| `254736815546` |
| Rohi Ogula       | `254799031228` |
| Guest            | _(not sent)_   |

Your backend can subscribe to the Event Grid topic (`mesh-ai-chat-topic`) and reuse the same event-handling pipeline that currently powers your WhatsApp webhook.

## Scripts

| Command        | Purpose                                      |
| -------------- | -------------------------------------------- |
| `bun install`  | Install dependencies                         |
| `bun dev`      | Start Next.js in dev mode with Bun           |
| `bun run build`| Production build                             |
| `bun run lint` | ESLint (already run during this change set)  |

> **Note:** The CLI environment used for this refactor did not have `bun` installed, so `npm run lint` was executed to validate the code instead. Once Bun is available locally, `bun dev` should behave the same as `npm run dev`.

## Architecture Overview

```
app/
  page.tsx              → Server component that seeds the contact list + assistant profile
  api/                  → Minimal ACS + AI routes (chat config, threads, AI events, Event Grid receiver)
components/chat-shell/  → Client layout (auth modal, contacts, recents, ACS workspace)
lib/
  constants/            → Hard-coded pilot profiles (names, passwords, colors)
  db/                   → ChatDatabase interface + in-memory implementation
  hooks/                → Adapter instrumentation (read receipts, AI bridge trigger)
  services/             → ACS orchestration, Event Grid publisher, environment helpers
```

### Data Layer
- `ChatDatabase` defines the contract for listing users, threads, and persisting metadata.
- `InMemoryChatDatabase` seeds a few sample personas and keeps participant-indexed thread lookups.
- Swap in a real repository by implementing the same interface and replacing the provider.

### ACS + Event Layer
- `chatOrchestrator.ts` mints Communication identities, issues tokens, creates threads, and delivers assistant responses through the server-side `ChatClient`.
- `aiEventBridge.ts` publishes user→AI messages to Event Grid so downstream processors can call LLMs and emit AI response events.
- `azureEnvironment.ts` centralizes ACS + Event Grid configuration so credentials are fetched once per runtime.

### Client Experience
- `ChatExperience` orchestrates auth state, caching, and ACS adapter bootstrapping while delegating presentation to smaller components.
- `ConversationSurface` wraps `ChatComposite`, forces a mobile form factor on small screens, and wires hooks for read receipts + AI bridge publishing.
- `SidebarPanel` renders the floating contacts + recents drawer, and `AuthModal` hosts the persona picker / login modal.

## Development Tips
- Ensure `NEXT_ACS_CONNECTION_STRING` is scoped to a resource with Chat privileges; each page load provisions ephemeral identities for the personas.
- Configure `NEXT_EVENT_GRID_TOPIC_ENDPOINT` and `NEXT_EVENT_GRID_TOPIC_KEY` so `/api/ai/messages` can publish user prompts to Event Grid. The `/api/ai/respond` route handles the Event Grid subscription handshake and should be the endpoint target for AI response events.
- The in-memory DB resets on server restart. Replace it with a persistent store by implementing the `ChatDatabase` interface.
- Observe server logs for AI response flow; only Event Grid is used for AI messaging (no websockets/SSE), and ACS delivers both human + AI traffic to the UI for accurate receipts.
