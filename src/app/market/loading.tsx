export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-4 h-6 w-64 rounded-full bg-panel2" />
      <div className="mb-2 h-8 w-72 rounded bg-panel2" />
      <div className="mb-6 h-4 w-96 max-w-full rounded bg-panel2" />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 w-32 rounded-lg bg-panel2" />)}
      </div>
      {/* Pass banner */}
      <div className="glass-card mb-6 flex items-center justify-between p-4">
        <div className="space-y-2"><div className="h-4 w-40 rounded bg-panel2" /><div className="h-3 w-72 max-w-full rounded bg-border" /></div>
        <div className="h-8 w-20 rounded bg-panel2" />
      </div>
      {/* Search + filters */}
      <div className="glass-card mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="h-9 min-w-[220px] flex-1 rounded-lg bg-panel2" />
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-7 w-24 rounded-full bg-border" />)}
      </div>
      <div className="mb-6 flex flex-wrap gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-7 w-20 rounded-full bg-border" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 rounded-xl border border-border bg-panel2" />)}
      </div>
    </div>
  );
}
