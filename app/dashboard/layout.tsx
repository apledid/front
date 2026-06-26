import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/current-profile"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { MobileSidebarController } from "@/components/dashboard/mobile-sidebar-controller"
import { DashboardEmailCheck } from "@/components/dashboard/dashboard-email-check"
import { DiscordMoveBanner } from "@/components/dashboard/discord-move-banner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect("/login")
  }

  if (profile.is_banned) {
    redirect('/banned')
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar profile={profile} />
      {/* lg:ml-[270px] reserves space for the now-fixed sidebar so the
          main column starts to the right of it instead of underneath
          it. Below the lg breakpoint the sidebar is hidden (the
          mobile drawer takes over) so no margin is needed. */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[270px]">
        <MobileSidebarController profile={profile} />
        {/* Content max-width was max-w-screen-2xl (1536px), which left
            big empty bands on 1920px+ monitors and ~2000px of waste on
            4K. min(95vw, 1800px) lets the dashboard scale up to fill
            wide displays while still stopping at 1800px so text lines
            don't get unreadably long on 5K+ ultrawides. The 95vw floor
            also keeps a small breathing margin on every monitor size
            so content isn't flush against the sidebar / right edge. */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-6 lg:p-8 2xl:p-10">
          <div
            className="mx-auto w-full min-w-0"
            style={{ maxWidth: 'min(95vw, 1800px)' }}
          >
            <DiscordMoveBanner />
            {children}
          </div>
        </main>
      </div>
      <DashboardEmailCheck
        email={profile.email}
        emailVerified={profile.email_verified ?? false}
        emailDeadline={profile.email_deadline}
      />
    </div>
  )
}
