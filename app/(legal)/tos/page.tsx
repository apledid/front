import { Metadata } from 'next'
import Link from 'next/link'
import { IconArrowLeft } from '@tabler/icons-react'

export const metadata: Metadata = {
  title: 'Terms of Service | halo.rip',
  description: 'Terms of Service for halo.rip',
}

export default function TermsOfService() {
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
            <h1 className="mt-3 text-h1 font-display">Terms of Service</h1>
            <p className="mt-3 text-sm text-muted-foreground">Last updated: April 6, 2026</p>
          </header>

          <div className="mt-12 space-y-12 text-foreground-secondary leading-relaxed">
            <section>
              <h2 className="text-h3 font-display text-foreground">1. Acceptance of Terms</h2>
              <p className="mt-4">
                By accessing or using halo.rip (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">2. Description of Service</h2>
              <p className="mt-4">
                halo.rip is a profile customization platform that allows users to create and share personalized profile pages.
                The Service includes features for customizing appearance, adding social links, music, and other content.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">3. User Accounts</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>You must provide accurate and complete information when creating an account.</li>
                <li>You are responsible for maintaining the security of your account credentials.</li>
                <li>You must be at least 13 years old to use this Service.</li>
                <li>One account per person. Multiple accounts are not permitted.</li>
                <li>Temporary or disposable email addresses are not allowed for registration.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">4. Prohibited Content</h2>
              <p className="mt-4">You agree not to upload, post, or share content that:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>Is illegal, harmful, threatening, abusive, harassing, defamatory, or otherwise objectionable</li>
                <li>Infringes on intellectual property rights of others</li>
                <li>Contains sexually explicit material or promotes violence</li>
                <li>Contains malware, viruses, or other harmful code</li>
                <li>Impersonates another person or entity</li>
                <li>Violates the privacy of others</li>
                <li>Promotes discrimination based on race, gender, religion, nationality, disability, sexual orientation, or age</li>
              </ul>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">5. Prohibited Activities</h2>
              <p className="mt-4">You agree not to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6 marker:text-primary/60">
                <li>Use automated systems (bots, scrapers, etc.) to access the Service without permission</li>
                <li>Attempt to gain unauthorized access to other accounts or systems</li>
                <li>Interfere with or disrupt the Service or servers</li>
                <li>Use the Service for any illegal purpose</li>
                <li>Sell or transfer your account to another party</li>
                <li>Create accounts using automated methods</li>
              </ul>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">6. Premium Features</h2>
              <p className="mt-4">
                Premium features are provided as-is. Refunds may be issued at our discretion.
                Premium status does not exempt users from these Terms of Service.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">7. Content Ownership</h2>
              <p className="mt-4">
                You retain ownership of content you upload. By uploading content, you grant halo.rip a
                non-exclusive license to display and distribute that content as part of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">8. Termination</h2>
              <p className="mt-4">
                We reserve the right to suspend or terminate your account at any time for violations of these terms
                or for any other reason at our sole discretion. Upon termination, your right to use the Service
                ceases immediately.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">9. Disclaimer of Warranties</h2>
              <p className="mt-4">
                THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.
                WE DO NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">10. Limitation of Liability</h2>
              <p className="mt-4">
                IN NO EVENT SHALL halo.rip BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
                OR PUNITIVE DAMAGES ARISING OUT OF YOUR USE OF THE SERVICE.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">11. Changes to Terms</h2>
              <p className="mt-4">
                We may modify these terms at any time. Continued use of the Service after changes
                constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h2 className="text-h3 font-display text-foreground">12. Contact</h2>
              <p className="mt-4">
                For questions about these Terms of Service, please contact us through the Service&apos;s
                support channels.
              </p>
            </section>
          </div>

          <div className="mt-16 border-t border-border pt-8">
            <Link
              href="/privacy"
              className="text-sm font-medium text-primary transition-colors hover:brightness-110"
            >
              View Privacy Policy
            </Link>
          </div>
        </article>
      </main>
    </div>
  )
}
