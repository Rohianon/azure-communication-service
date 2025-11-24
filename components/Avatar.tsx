import { Bot } from 'lucide-react'

const FluentAvatar = ({ name, isBot = false, size = 'md' }: { name: string, isBot?: boolean, size?: 'sm' | 'md' | 'lg' }) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-xs", // Fluent avatars are often compact
    lg: "w-24 h-24 text-xl"
  }
  
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '?'

  return (
    <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold relative shrink-0 border border-white shadow-sm ${isBot ? 'bg-[#E3008C] text-white' : 'bg-[#0078D4] text-white'}`}>
      {isBot ? <Bot size={size === 'sm' ? 14 : 18} /> : initials}
      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${isBot ? 'bg-[#6BB700]' : 'bg-[#6BB700]'}`}></span>
    </div>
  )
}

export default FluentAvatar