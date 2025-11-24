type EmptyScreenProps = {
  loggedIn: boolean
  loading: boolean
}

function EmptyScreen({ loggedIn, loading }: EmptyScreenProps) {
  if (!loggedIn) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/70 text-center">
        <p className="text-lg font-semibold text-white">Sign in to start chatting</p>
        <p className="mt-2 text-sm text-slate-400">Use one of the pilot profiles to unlock the contact list.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-slate-800/70 text-center text-slate-300">
        <p className="text-base font-semibold">Preparing your conversation…</p>
        <p className="text-sm text-slate-500">ACS chat adapter is initializing.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800/70 text-center text-slate-300">
      <p className="text-base font-semibold">No thread selected</p>
      <p className="mt-2 text-sm text-slate-500">Tap a contact or recent chat to open the message view.</p>
    </div>
  )
}

export default EmptyScreen