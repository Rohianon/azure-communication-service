"use client"

import type { PresenceStatus } from '@/lib/types/chat'

export function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((segment) => segment.charAt(0).toUpperCase())
    .join('')
}

export function formatTime(timestamp?: string) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function presenceColor(status: PresenceStatus) {
  switch (status) {
    case 'online':
      return 'bg-emerald-400'
    case 'away':
      return 'bg-amber-400'
    default:
      return 'bg-slate-500'
  }
}
