export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-4 h-6 w-56 rounded-full bg-panel2" />
      <div className="mb-2 h-8 w-64 rounded bg-panel2" />
      <div className="mb-7 h-4 w-[36rem] max-w-full rounded bg-panel2" />
      {/* Filter panel */}
      <div className="glass-card space-y-5 p-5 md:p-6">
        <div className="flex flex-wrap gap-1.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 w-24 rounded-full bg-panel2" />)}</div>
        <div className="h-11 w-full rounded-lg bg-panel2" />
        <div className="flex flex-wrap gap-1.5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-8 w-28 rounded-full bg-border" />)}</div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 rounded-lg bg-panel2" />)}</div>
      </div>
      <div className="mb-4 mt-6 h-4 w-32 rounded bg-panel2" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 rounded-xl border border-border bg-panel2" />)}
      </div>
    </div>
  );
}
