"use client"

import type { ChatThreadMode } from '@/lib/types/chat'

import { formatTime } from '../lib/utils/uiHelpers'
import ContactList, { ContactListItem } from './ContactList'



type SidebarThread = {
  id: string
  topic: string
  mode: ChatThreadMode
  lastActivityAt?: string
  lastMessagePreview?: string
}

type ActiveProfile = {
  id: string
  displayName: string
} | null

type SidebarPanelProps = {
  open: boolean
  toggleSidebar: () => void
  activeProfile: ActiveProfile
  contacts: ContactListItem[]
  focusedContactId: string | null
  contactsDisabled: boolean
  loadingThreads: boolean
  threads: SidebarThread[]
  selectedThreadId: string | null
  onContactPress: (contactId: string, role: 'assistant' | 'human') => void
  onThreadSelect: (threadId: string) => void
  onSignOut: () => void
  onCloseMobile: () => void
}

export default function SidebarPanel({
  open,
  toggleSidebar,
  activeProfile,
  contacts,
  focusedContactId,
  contactsDisabled,
  loadingThreads,
  threads,
  selectedThreadId,
  onContactPress,
  onThreadSelect,
  onSignOut,
  onCloseMobile
}: SidebarPanelProps) {
  return (
    <div>
      <div className="group fixed right-4 top-4 z-50 lg:right-8 lg:top-6">
              <button
                type="button"
                aria-pressed={open}
                aria-label={open ? 'Hide contacts panel' : 'Show contacts panel'}
                onClick={toggleSidebar}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-slate-100 shadow-xl backdrop-blur transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
                onMouseEnter={toggleSidebar}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  {open ? (
                    <path
                      d="M7 7l10 10M17 7l-10 10"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  ) : (
                    <path
                      d="M5 7h14M5 12h14M5 17h14"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
              </button>
            </div>
        <div
        className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onCloseMobile}
      />
      <aside
        className={`fixed inset-y-4 left-4 z-40 flex h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-sm flex-col overflow-hidden rounded-[32px] border border-slate-800/80 bg-gradient-to-b from-slate-950/95 via-slate-950/80 to-slate-950/70 p-5 text-slate-100 shadow-[0_20px_60px_rgba(2,10,31,0.65)] ring-1 ring-slate-900/60 backdrop-blur-xl transition-all duration-300 lg:static lg:h-auto lg:w-80 lg:max-w-none lg:p-6 ${
          open
            ? 'translate-x-0 opacity-100 lg:opacity-100'
            : '-translate-x-[calc(100%+1.5rem)] opacity-0 lg:w-0 lg:p-0 lg:opacity-0 lg:pointer-events-none'
        }`}
      >
        <div className="relative flex h-full flex-col gap-6 overflow-y-auto pr-2 lg:pr-1">
          <button
            type="button"
            className="absolute left-0 top-0 inline-flex h-9 w-9 -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-lg transition hover:bg-white/20 lg:hidden"
            aria-label="Close contacts panel"
            onClick={onCloseMobile}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
          <div className="rounded-[28px] border border-white/10 bg-slate-900/40 p-5 shadow-inner shadow-slate-950/20">
            {activeProfile ? (
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Signed in as</p>
                <p className="mt-2 text-xl font-semibold text-white">{activeProfile.displayName}</p>
                <button
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-slate-500"
                  onClick={onSignOut}
                >
                  Switch profile
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-300">Sign in to unlock your Mesh DMs.</p>
                <p className="text-xs text-slate-500">Pick any of the four demo profiles from the modal.</p>
              </div>
            )}
          </div>
          <ContactList
            contacts={contacts}
            activeContactId={focusedContactId}
            disabled={contactsDisabled}
            loading={loadingThreads}
            onSelect={onContactPress}
          />
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelect={onThreadSelect}
            loading={loadingThreads}
          />
        </div>
      </aside>
    </div>
  )
}



type ThreadListProps = {
  threads: SidebarThread[]
  selectedThreadId: string | null
  onSelect: (threadId: string) => void
  loading: boolean
}

function ThreadList({ threads, selectedThreadId, onSelect, loading }: ThreadListProps) {
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-500">
        <span>Recents</span>
        {loading ? <span className="text-slate-400">Connecting…</span> : null}
      </div>
      <div className="mt-3 space-y-3">
        {threads.map((thread) => {
          const isActive = selectedThreadId === thread.id
          return (
            <button
              key={thread.id}
              onClick={() => onSelect(thread.id)}
              className={`w-full rounded-[24px] border px-4 py-4 text-left text-sm transition ${
                isActive
                  ? 'border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 via-slate-900/30 to-slate-950/60 text-white shadow-[0_10px_35px_rgba(16,185,129,0.35)]'
                  : 'border-white/5 bg-slate-900/40 text-slate-200 shadow-[0_8px_30px_rgba(2,8,23,0.55)] hover:border-white/10 hover:bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-white">{thread.topic}</p>
                <span className="text-xs text-slate-400">{formatTime(thread.lastActivityAt)}</span>
              </div>
              <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-slate-500">
                {thread.mode === 'ai' ? 'AI coaching' : 'Direct message'}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-300">{thread.lastMessagePreview ?? 'No messages yet'}</p>
            </button>
          )
        })}
        {!threads.length && !loading ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-4 py-6 text-center text-xs text-slate-400">
            Your chats will appear here once you message someone.
          </div>
        ) : null}
      </div>
    </div>
  )
}
