export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-6 h-4 w-40 rounded bg-panel2" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 shrink-0 rounded-xl bg-panel2" />
            <div className="flex-1 space-y-3">
              <div className="h-7 w-64 max-w-full rounded bg-panel2" />
              <div className="h-4 w-40 rounded bg-border" />
              <div className="flex gap-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 w-20 rounded-full bg-border" />)}</div>
            </div>
          </div>
          {/* Body blocks */}
          <div className="glass-card space-y-3 p-5">
            <div className="h-4 w-full rounded bg-border" />
            <div className="h-4 w-11/12 rounded bg-border" />
            <div className="h-4 w-4/5 rounded bg-border" />
          </div>
          <div className="glass-card h-48 p-5" />
        </div>
        {/* Sidebar / subscribe */}
        <div className="space-y-4">
          <div className="glass-card p-5">
            <div className="h-8 w-24 rounded bg-panel2" />
            <div className="mt-4 h-10 w-full rounded-lg bg-panel2" />
            <div className="mt-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-3 w-full rounded bg-border" />)}</div>
          </div>
          <div className="glass-card h-32 p-5" />
        </div>
      </div>
    </div>
  );
}
