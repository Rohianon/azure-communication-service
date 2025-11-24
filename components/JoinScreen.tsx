import { Activity, LogIn } from "lucide-react"
import { useState } from "react"
import FluentButton from "./Button"


const JoinScreen = ({ onJoin }: { onJoin: (name: string) => void }) => {
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsLoading(true)
    setTimeout(() => { onJoin(name); setIsLoading(false) }, 800)
  }

  return (
    <div className="min-h-screen bg-[#F3F2F1] flex items-center justify-center p-4 font-[Segoe UI,sans-serif]">
      <div className="max-w-[400px] w-full bg-white shadow-lg rounded-sm overflow-hidden">
        <div className="h-2 bg-[#0078D4]"></div>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-[#0078D4] rounded-md flex items-center justify-center text-white">
               <Activity size={24} />
             </div>
             <h1 className="text-xl font-semibold text-[#201F1E]">Contoso Support</h1>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-semibold text-[#323130] mb-2">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                className="block w-full px-3 py-2 border border-[#8A8886] rounded-[2px] focus:outline-none focus:border-[#0078D4] focus:ring-1 focus:ring-[#0078D4] transition-colors"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <FluentButton 
              className="w-full !py-2" 
              icon={isLoading ? undefined : LogIn}
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? 'Joining Call...' : 'Start Chat'}
            </FluentButton>
          </form>
          
          <div className="mt-8 text-center border-t border-[#EDEBE9] pt-4">
             <p className="text-xs text-[#605E5C]">
               Visual Preview of <strong>@azure/communication-react</strong>
             </p>
          </div>
        </div>
      </div>
    </div>
  )
}


export default JoinScreen