import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/current-profile"
import { getFreeEventActive } from "@/lib/get-free-event-active"
import { createAdminClient } from "@/lib/supabase/admin"
import { LinksEditor } from "@/components/dashboard/links-editor"
import LinksSettingsToggle from "./settings-toggle"

export default async function LinksPage() {
  const [profile, freeEventActive] = await Promise.all([
    getCurrentProfile(),
    getFreeEventActive(),
  ])

  if (!profile) {
    redirect("/login")
  }

  const supabase = createAdminClient()

  const { data: socialLinks } = await supabase
    .from("social_links")
    .select("*")
    .eq("user_id", profile.id)
    .order("display_order")

  const isPremium = profile.premium_active === true || freeEventActive

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Social Links</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your social media profiles and custom links
        </p>
      </div>

      <LinksSettingsToggle
        // Default to TRUE (no background) so the cleaner icon-only look is
        // the out-of-the-box default. Users who want the pill background
        // can toggle it off explicitly. Migration 062 backfills existing
        // NULL / unset rows + flips the DB default; this fallback only
        // matters until that migration runs.
        initialNoBackground={(profile as any).social_icons_no_background ?? true}
        initialMonochrome={profile.monochrome_icons ?? false}
        isPremium={isPremium}
      />

      <LinksEditor
        userId={profile.id}
        socialLinks={socialLinks || []}
        customButtons={[]}
      />
    </div>
  )
}
