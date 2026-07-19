export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-2 h-8 w-56 rounded bg-panel2" />
      <div className="mb-6 h-4 w-80 max-w-full rounded bg-border" />
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 w-28 rounded-full bg-panel2" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card flex items-start gap-4 p-4">
            <div className="h-7 w-7 shrink-0 rounded-full bg-panel2" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-panel2" />
              <div className="h-3 w-full rounded bg-border" />
              <div className="h-3 w-24 rounded bg-border" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
