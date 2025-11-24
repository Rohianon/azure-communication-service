"use client"

import FluentAvatar from "@/components/Avatar"
import FluentButton from "@/components/Button"
import JoinScreen from "@/components/JoinScreen"
import { Activity, Check, Mic, Paperclip, Phone, Send, Smile, Users } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type Message = {
  id: string
  senderId: string
  senderDisplayName: string
  content: string
  createdOn: Date
  type: 'text' | 'system'
  status?: 'sending' | 'sent' | 'seen'
  mine?: boolean
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<{id: string, displayName: string} | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderId: 'bot-1',
      senderDisplayName: 'Support Bot',
      content: 'Welcome to Contoso Support! This preview simulates the official Azure Communication Services UI Library.',
      createdOn: new Date(Date.now() - 60000),
      type: 'text',
      mine: false
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim() || !currentUser) return

    // 1. Optimistic Update (Standard UI does this automatically)
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderDisplayName: currentUser.displayName,
      content: inputValue,
      createdOn: new Date(),
      type: 'text',
      status: 'sending',
      mine: true
    }
    setMessages(prev => [...prev, newMessage])
    setInputValue('')
    setIsSending(true)

    // 2. Webhook Integration Logic (Simulated here, real code in Markdown)
    try {
      const response = await fetch('https://gf-mesh-backend-copy-production.up.railway.app/azure/chat/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          eventType: 'Microsoft.Communication.ChatMessageReceived',
          data: {
            message: { content: inputValue, senderDisplayName: currentUser.displayName }
          }
        }])
      })

      if (response.ok) {
        setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, status: 'sent' } : m))
        
        const payload = await response.json().catch(() => null)
        const normalized = Array.isArray(payload) ? payload[0] : payload
        const reply = typeof normalized?.response === 'string' ? normalized.response : ''

        if (reply) {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            senderId: 'bot-1',
            senderDisplayName: 'Support Bot',
            content: reply,
            createdOn: new Date(),
            type: 'text',
            mine: false
          }])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  if (!currentUser) return <JoinScreen onJoin={(name) => setCurrentUser({ id: 'me', displayName: name })} />

  return (
    <div className="flex h-screen bg-[#F3F2F1] font-[Segoe UI,sans-serif] text-[#201F1E]">
      
      {/* Disclaimer Banner */}
      <div className="fixed top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-300 text-yellow-900 px-4 py-1 text-xs text-center z-50">
        <strong>Preview Mode:</strong> This simulates the look of <code>@azure/communication-react</code>. See the <strong>Right Panel</strong> for the actual code implementation.
      </div>

      {/* Main Composite Area (Mimicking ChatComposite) */}
      <div className="flex-1 flex flex-col pt-6 max-w-[100vw]">
        
        {/* Header (Fluent Style) */}
        <div className="bg-white border-b border-[#EDEBE9] px-4 py-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
             <div className="font-semibold text-lg">Contoso Support</div>
             <div className="bg-[#EFF6FC] text-[#0078D4] text-xs px-2 py-0.5 rounded-full font-medium">Chat</div>
          </div>
          <div className="flex gap-2">
            <FluentButton variant="icon" icon={Users} />
            <FluentButton variant="primary" icon={Phone}>Call</FluentButton>
          </div>
        </div>

        {/* Message Thread (Mimicking MessageThread component) */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
           <div className="max-w-4xl mx-auto space-y-4">
              <div className="text-center text-xs text-[#605E5C] my-4">Today</div>
              
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.mine ? 'flex-row-reverse' : ''}`}>
                  {!msg.mine && <FluentAvatar name={msg.senderDisplayName} isBot={msg.senderDisplayName.includes('Bot')} size="sm" />}
                  
                  <div className={`flex flex-col max-w-[70%] ${msg.mine ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-semibold text-[#323130]">{msg.senderDisplayName}</span>
                      <span className="text-[10px] text-[#605E5C]">{msg.createdOn.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                    
                    <div className={`px-3 py-2 text-sm shadow-sm break-words ${
                      msg.mine 
                        ? 'bg-[#E1DFDD] text-[#201F1E] rounded-t-lg rounded-bl-lg' // Fluent "My Message" style is often gray or blue depending on theme
                        : 'bg-[#F3F2F1] text-[#201F1E] rounded-t-lg rounded-br-lg'
                    }`}>
                      {msg.content}
                    </div>
                    
                    {msg.mine && (
                       <div className="text-[10px] text-[#0078D4] flex items-center gap-1 mt-1">
                          {msg.status === 'sending' ? <Activity size={10} className="animate-spin" /> : <Check size={10} />}
                          {msg.status === 'sending' ? 'Sending' : 'Sent'}
                       </div>
                    )}
                  </div>
                </div>
              ))}
              {isSending && <div className="text-xs text-[#605E5C] ml-12">Support Bot is typing...</div>}
              <div ref={messagesEndRef} />
           </div>
        </div>

        {/* Send Box (Mimicking SendBox component) */}
        <div className="p-4 bg-white border-t border-[#EDEBE9]">
          <div className="max-w-4xl mx-auto">
             <form onSubmit={handleSendMessage} className="relative">
                <input 
                  className="w-full bg-white border border-[#8A8886] rounded-[4px] py-2.5 pl-3 pr-12 text-sm focus:border-[#0078D4] focus:ring-1 focus:ring-[#0078D4] outline-none"
                  placeholder="Type a message..."
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                />
                <div className="absolute right-2 top-1.5 flex items-center gap-1">
                   <button type="button" className="p-1.5 text-[#605E5C] hover:bg-[#F3F2F1] rounded"><Smile size={18} /></button>
                   <button type="submit" disabled={!inputValue.trim()} className="p-1.5 text-[#0078D4] hover:bg-[#EFF6FC] rounded disabled:opacity-50">
                     <Send size={18} />
                   </button>
                </div>
             </form>
             <div className="flex gap-4 mt-2 justify-between">
                <div className="flex gap-1">
                   <FluentButton variant="icon" icon={Paperclip} />
                   <FluentButton variant="icon" icon={Mic} />
                </div>
             </div>
          </div>
        </div>
        
      </div>
    </div>
  )
}