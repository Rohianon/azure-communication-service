import { PresenceStatus } from "@/lib/types/chat"
import { formatTime, initials, presenceColor } from "@/lib/utils/uiHelpers"

export type ContactListItem = {
  id: string
  displayName: string
  accentColor: string
  presence: PresenceStatus
  role: 'assistant' | 'human'
  description?: string
  disabled?: boolean
  lastMessagePreview?: string
  lastActivityAt?: string
  unreadCount?: number
  isSelf?: boolean
}

type ContactListProps = {
  contacts: ContactListItem[]
  activeContactId: string | null
  onSelect: (contactId: string, role: 'assistant' | 'human') => void
  disabled: boolean
  loading: boolean
}

function ContactList({ contacts, activeContactId, onSelect, disabled, loading }: ContactListProps) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-slate-500">
        <span>Contacts</span>
        {loading ? <span className="text-slate-400">Syncing…</span> : null}
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {contacts.map((contact) => {
          const isActive = activeContactId === contact.id
          return (
            <button
              key={contact.id}
              disabled={disabled || contact.disabled}
              onClick={() => onSelect(contact.id, contact.role)}
              className={`group flex items-center gap-4 rounded-[26px] border px-4 py-4 text-left text-sm transition ${
                isActive
                  ? 'border-sky-500/40 bg-gradient-to-r from-sky-500/20 via-slate-900/40 to-slate-950/60 text-white shadow-[0_10px_35px_rgba(14,165,233,0.35)]'
                  : 'border-white/5 bg-slate-900/40 text-slate-200 shadow-[0_8px_30px_rgba(2,8,23,0.55)] hover:border-white/10 hover:bg-slate-900/60'
              } ${contact.disabled ? 'opacity-60' : ''}`}
            >
              <span
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-base font-semibold text-slate-950 shadow-inner"
                style={{ background: contact.accentColor }}
              >
                {initials(contact.displayName)}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-white">
                    {contact.displayName}
                    {contact.isSelf ? (
                      <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">You</span>
                    ) : null}
                  </p>
                  {contact.lastActivityAt ? <span className="text-xs text-slate-400">{formatTime(contact.lastActivityAt)}</span> : null}
                </div>
                <p className="text-xs text-slate-400">
                  {contact.description ?? (contact.role === 'assistant' ? 'AI assistant' : 'Mesh member')}
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.25em] text-slate-500">
                    <span className={`h-2 w-2 rounded-full ${presenceColor(contact.presence)}`} />
                    {contact.presence}
                  </span>
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-slate-300">
                  {contact.lastMessagePreview || (contact.role === 'assistant' ? 'Share what you are working on.' : 'Tap to start a DM.')}
                </p>
              </div>
              {contact.unreadCount ? (
                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-500/20 px-2 text-xs font-semibold text-emerald-200">
                  {contact.unreadCount}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ContactList 
