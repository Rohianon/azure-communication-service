import ChatExperience from '@/components/ChatExperience'
import { getAssistantProfile, listHumanUsers } from '@/lib/services/chatOrchestrator'
import { serializeUser } from '@/lib/utils/serialization'

export default async function Home() {
  const users = await listHumanUsers()
  const assistant = await getAssistantProfile()

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <ChatExperience
        initialUsers={users.map(serializeUser)}
        assistant={assistant}
      />
    </main>
  )
}
