export default function Loading() {
  return (
    <div className="animate-pulse py-4" aria-hidden>
      <div className="mb-2 h-7 w-48 rounded bg-panel2" />
      <div className="mb-6 h-4 w-72 max-w-full rounded bg-border" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-20 w-20 rounded-full bg-panel2" />
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 w-full rounded-lg bg-panel2" />)}
        </div>
        <div className="glass-card h-96" />
      </div>
    </div>
  );
}
