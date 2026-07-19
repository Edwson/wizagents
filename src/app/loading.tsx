export default function Loading() {
  return (
    <div className="animate-pulse space-y-4 py-6">
      <div className="h-8 w-64 rounded bg-panel2" />
      <div className="h-4 w-96 rounded bg-panel2" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 rounded-xl border border-border bg-panel2" />)}
      </div>
    </div>
  );
}
