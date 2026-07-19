export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-2 h-8 w-56 rounded bg-panel2" />
      <div className="mb-6 h-4 w-80 max-w-full rounded bg-panel2" />
      {/* Stat row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-24 p-4"><div className="h-3 w-20 rounded bg-border" /><div className="mt-3 h-6 w-16 rounded bg-panel2" /></div>)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-20 p-4"><div className="h-4 w-40 rounded bg-panel2" /><div className="mt-3 h-3 w-64 max-w-full rounded bg-border" /></div>)}
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card h-28 p-4" />)}
        </div>
      </div>
    </div>
  );
}
