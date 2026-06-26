import { getCurrentProfileSummary } from '@/lib/current-profile'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { PricingClient } from '@/components/halo/pricing-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PricingPage() {
  const profile = await getCurrentProfileSummary()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav username={profile?.username ?? null} />
      <main>
        <PricingClient
          loggedIn={Boolean(profile)}
          alreadyPremium={profile?.premium_active === true}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
