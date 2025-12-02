"use client"

import type { PropsWithChildren } from 'react'

type MessageBubbleProps = PropsWithChildren<{
  timestamp?: string
  isOwn: boolean
}>

export default function MessageBubble({ timestamp, isOwn, children }: MessageBubbleProps) {
  return (
    <div className={`flex w-full flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
      <div
        className={`
          relative px-4 py-2.5 text-sm leading-relaxed shadow-sm max-w-[90%] text-white
          ${isOwn
            ? 'bg-red-500 rounded-2xl rounded-br-none'
            : 'bg-violet-600 rounded-2xl rounded-bl-none'
          }
        `}
      >
        <div className="mesh-message-content">
          {children}
        </div>
      </div>

      <div className={`mt-1 text-[10px] font-medium text-slate-500 ${isOwn ? 'text-right' : 'text-left'}`}>
        {timestamp}
      </div>
    </div>
  )
}