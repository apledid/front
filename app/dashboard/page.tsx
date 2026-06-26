import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/current-profile"
import { RezOverview } from "@/components/dashboard/rez-overview"

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  if (!profile) redirect("/login")

  const uname = profile.username || 'user'
  const uidDisplay = (profile as any).uid != null
    ? Number((profile as any).uid).toLocaleString()
    : profile.id.slice(0, 6)

  return (
    <RezOverview
      username={uname}
      displayName={profile.display_name || uname}
      uidDisplay={uidDisplay}
      viewCount={profile.view_count || 0}
      profileUrl={`https://halo.rip/${uname}`}
      profilePath={`/${uname}`}
    />
  )
}
