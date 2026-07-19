export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-2 h-8 w-52 rounded bg-panel2" />
      <div className="mb-6 h-4 w-72 max-w-full rounded bg-panel2" />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="glass-card h-24 p-4"><div className="h-3 w-16 rounded bg-border" /><div className="mt-3 h-6 w-14 rounded bg-panel2" /></div>)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass-card p-5">
            <div className="mb-4 h-5 w-40 rounded bg-panel2" />
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, j) => <div key={j} className="h-4 w-full rounded bg-border" />)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
