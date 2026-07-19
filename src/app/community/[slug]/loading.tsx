export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-3 h-4 w-40 rounded bg-border" />
      <div className="glass-card p-6">
        <div className="mb-3 h-7 w-3/4 rounded bg-panel2" />
        <div className="mb-5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-panel2" /><div className="h-3 w-32 rounded bg-border" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-4 w-full rounded bg-border" />)}
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card h-24 p-4" />)}
      </div>
    </div>
  );
}
