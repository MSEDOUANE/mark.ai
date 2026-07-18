export default function DashboardLoading() {
  return (
    <main className="min-h-screen px-4 py-5 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-app-surface-2" />
        <div className="mt-2 h-4 w-72 rounded bg-app-surface" />

        <div className="mt-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-app-border bg-app-surface/60 p-4">
              <div className="h-3 w-16 rounded bg-app-surface-2" />
              <div className="mt-3 h-8 w-14 rounded bg-app-surface-2" />
            </div>
          ))}
        </div>

        <div className="mt-4 h-12 rounded-xl border border-app-border bg-app-surface/60" />

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-app-border bg-app-surface/60 p-5">
              <div className="h-3 w-24 rounded bg-app-surface-2" />
              <div className="mt-4 space-y-2">
                <div className="h-3 rounded bg-app-surface-2" />
                <div className="h-3 rounded bg-app-surface-2" />
                <div className="h-3 w-2/3 rounded bg-app-surface-2" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-app-border bg-app-surface/60 p-5">
              <div className="h-3 w-28 rounded bg-app-surface-2" />
              <div className="mt-4 space-y-2">
                <div className="h-10 rounded bg-app-surface-2" />
                <div className="h-10 rounded bg-app-surface-2" />
                <div className="h-10 rounded bg-app-surface-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
