"use client"

import { useState } from 'react'

import { HARD_CODED_USERS } from '@/lib/constants/users'

import { initials, presenceColor } from '../lib/utils/uiHelpers'

type AuthModalProps = {
  open: boolean
  onSelectUser: (userId: string) => Promise<void> | void
}

export default function AuthModal({ open, onSelectUser }: AuthModalProps) {
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = async (userId: string) => {
    if (pendingUserId) {
      return
    }
    setError(null)
    setPendingUserId(userId)
    try {
      await onSelectUser(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
      setPendingUserId(null)
      return
    }
    setPendingUserId(null)
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold text-white">Choose your profile</h1>
        <p className="mt-2 text-sm text-slate-400">Pick one of the demo accounts to jump right into the chat experience.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {HARD_CODED_USERS.map((user) => {
            const isPending = pendingUserId === user.id
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelect(user.id)}
                disabled={Boolean(pendingUserId) && !isPending}
                className={`flex flex-col gap-4 rounded-3xl border px-4 py-4 text-left transition ${
                  isPending ? 'border-white/70 bg-white/10' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                } disabled:opacity-60`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-base font-semibold text-slate-950"
                    style={{ background: user.accentColor }}
                  >
                    {initials(user.displayName)}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{user.displayName}</p>
                    <p className="text-xs text-slate-400">
                      <span className={`mr-2 inline-flex h-2 w-2 rounded-full ${presenceColor(user.presence)}`} />
                      {user.id === 'guest' ? 'Guest access' : 'Mesh member'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                  <span>{user.id === 'guest' ? 'Shared device friendly' : 'Personal profile'}</span>
                  <span>{isPending ? 'Connecting…' : 'Sign in'}</span>
                </div>
              </button>
            )
          })}
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        <p className="mt-6 text-xs text-slate-500">You can switch accounts anytime from the sidebar.</p>
      </div>
    </div>
  )
}
