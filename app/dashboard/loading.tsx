/**
 * Dashboard route-level loading skeleton.
 *
 * The dashboard page is a server component that `await`s
 * `getCurrentProfile()` - during that round-trip the user used to
 * see a blank page. Next.js auto-mounts this `loading.tsx` while
 * the server component resolves, so we paint a branded skeleton
 * shape that matches the final layout. When the real content
 * arrives, the swap-in is positionally identical (no layout shift).
 *
 * Mirrors the structure of `app/dashboard/page.tsx` (welcome heading
 * + URL card + 3 stat cards + 4 quick-action cards). If you re-shape
 * the dashboard, update this file too.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse sm:space-y-8">
      {/* Welcome heading */}
      <div>
        <div className="h-7 w-64 rounded-md bg-white/10" />
        <div className="mt-2 h-4 w-80 rounded-md bg-white/[0.05]" />
      </div>

      {/* Profile URL card */}
      <div className="h-20 rounded-2xl border border-[#e87fa0]/20 bg-[#e87fa0]/[0.05]" />

      {/* 3 stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl border border-white/[0.04] bg-white/[0.02] sm:h-[92px]"
          />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <div className="mb-4 h-3 w-28 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border border-white/[0.05] bg-white/[0.02] sm:h-32"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
