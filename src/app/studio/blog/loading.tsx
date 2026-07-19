export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-2 h-7 w-48 rounded bg-panel2" />
      <div className="mb-6 h-4 w-80 max-w-full rounded bg-border" />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-20" />)}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="glass-card h-20 p-4" />)}
      </div>
    </div>
  );
}
