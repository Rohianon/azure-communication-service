"use client"

import type { PropsWithChildren } from 'react'

type MessageBubbleProps = PropsWithChildren<{
  timestamp?: string
  isOwn: boolean
}>

export default function MessageBubble({ timestamp, isOwn, children }: MessageBubbleProps) {
  return (
    <div className={`flex w-full ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          relative max-w-[90%] rounded-2xl px-2.5 py-2.5 text-sm leading-relaxed text-white shadow-sm
          ${isOwn ? 'bg-red-500 rounded-br-none' : 'bg-violet-600 rounded-bl-none'}
        `}
      >
        <div className="mesh-message-content">{children}</div>
        {timestamp ? (
          <div className="text-[11px] font-medium text-white/80 text-right">{timestamp}</div>
        ) : null}
      </div>
    </div>
  )
}
