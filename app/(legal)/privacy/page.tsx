import { Metadata } from 'next'
import Link from 'next/link'
import { IconArrowLeft } from '@tabler/icons-react'

export const metadata: Metadata = {
  title: 'Privacy Policy | halo.rip',
  description: 'Privacy Policy for halo.rip',
}

export default function PrivacyPolicy() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="ds-container flex h-16 items-center">
        <Link
          href="/"
          className="font-display text-lg font-semibold tracking-tight"
          aria-label="halo.rip home"
        >
          <span className="text-foreground">halo</span>
          <span className="text-primary">.rip</span>
        </Link>
      </header>

      <main className="ds-container flex-1 pb-24 pt-6">
        <article className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconArrowLeft className="size-4" />
            Back to home
          </Link>

          <header className="mt-8">
            <p className="text-eyebrow uppercase text-primary/80">Legal</p>
            <h1 className="mt-3 text-h1 font-display">Privacy Policy</h1>
            <p className="mt-3 text-sm text-muted-foreground">Last updated: April 6, 2026</p>
          </header>

          <div className="mt-12 space-y-12 text-foreground-secondary leading-relaxed">
            <section>
              <h2 className="text-h3 font-display text-foreground">1. Information We Collect</h2>
              <p className="mt-4">We collect information you provide directly:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>Account information (username, email, password)</li>
                <li>Profile content (display name, bio, avatar, background images)</li>
                <li>Social links and custom buttons you add</li>
                <li>Music and media you upload</li>
              </ul>
              <p className="mt-5">We automatically collect:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>IP addresses (for security and abuse prevention)</li>
                <li>Device and browser information</li>
                <li>Usage data and analytics</li>
                <li>Profile view counts</li>
              </ul>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">2. How We Use Information</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>To provide and maintain the Service</li>
                <li>To personalize your experience</li>
                <li>To communicate with you about your account</li>
                <li>To enforce our Terms of Service</li>
                <li>To prevent fraud and abuse</li>
                <li>To improve and develop new features</li>
              </ul>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">3. Information Sharing</h2>
              <p className="mt-4">We do not sell your personal information. We may share information:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and safety</li>
                <li>With service providers who assist in operating our Service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">4. Data Security</h2>
              <p className="mt-4">
                We implement industry-standard security measures to protect your data, including encryption,
                secure password hashing, and regular security audits. However, no method of transmission
                over the Internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">5. Your Rights</h2>
              <p className="mt-4">You have the right to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your account and associated data</li>
                <li>Export your data</li>
                <li>Object to certain processing activities</li>
              </ul>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">6. Cookies</h2>
              <p className="mt-4">
                We use essential cookies for authentication and session management.
                These are necessary for the Service to function properly.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">7. Third-Party Services</h2>
              <p className="mt-4">
                We use third-party services including Cloudflare (for security), Railway (for hosting),
                and Supabase (for data storage). These services have their own privacy policies.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">8. Children&apos;s Privacy</h2>
              <p className="mt-4">
                The Service is not intended for children under 13. We do not knowingly collect
                information from children under 13.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">9. Data Retention</h2>
              <p className="mt-4">
                We retain your data for as long as your account is active. Upon account deletion,
                we will delete your personal data within 30 days, except where required by law.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">10. Changes to This Policy</h2>
              <p className="mt-4">
                We may update this Privacy Policy from time to time. We will notify you of significant
                changes through the Service or via email.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">11. Contact</h2>
              <p className="mt-4">
                For privacy-related questions or to exercise your rights, please contact us through
                the Service&apos;s support channels.
              </p>
            </section>
          </div>

          <div className="mt-16 border-t border-border pt-8">
            <Link
              href="/tos"
              className="text-sm font-medium text-primary transition-colors hover:brightness-110"
            >
              View Terms of Service
            </Link>
          </div>
        </article>
      </main>
    </div>
  )
}
