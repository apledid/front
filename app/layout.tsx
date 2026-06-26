import type { Metadata, Viewport } from 'next'
import { Inter, Space_Mono, Space_Grotesk, Roboto, Source_Sans_3, Quicksand } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { AccountStatusGuard } from '@/components/app/account-status-guard'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
})

// Display family for headings + the halo wordmark. A geometric grotesk gives
// the headline type its own voice, distinct from Inter on body/UI copy.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
})

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-roboto',
})

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-source-sans-3',
})

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-quicksand',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-to-zoom for accessibility. Capping max scale was causing
  // problems for low-vision users without actually fixing layout overflow.
  viewportFit: 'cover',
  themeColor: '#06060b',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://halo.rip'),
  title: 'halo.rip | Create your perfect profile',
  description:
    'Modern, feature-rich link-in-bio profiles with custom fonts, effects, music, and more.',
  openGraph: {
    type: 'website',
    siteName: 'halo.rip',
    url: '/',
    title: 'halo.rip | Create your perfect profile',
    description:
      'Modern, feature-rich link-in-bio profiles with custom fonts, effects, music, and more.',
    images: [{ url: '/api/og-cover?v=9', width: 1200, height: 630, alt: 'halo.rip' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'halo.rip | Create your perfect profile',
    description:
      'Modern, feature-rich link-in-bio profiles with custom fonts, effects, music, and more.',
    images: ['/api/og-cover?v=9'],
  },
  // Default site favicon. Per-route `generateMetadata` can override this
  // (see app/[username]/page.tsx - premium profiles get their own
  // favicon_url here). Setting icons via the metadata API instead of
  // hardcoded <link> tags in <head> lets the route-level value take
  // precedence; with hardcoded tags both would render and the browser
  // would pick whichever appeared first (always the layout's).
  icons: {
    icon: [
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Favicon <link> tags removed - moved to the `metadata.icons`
            export above so per-route generateMetadata can override
            them (custom favicon_url on /[username]). Hardcoded links
            in <head> always win over metadata-driven ones. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Comfortaa:wght@300;400;700&family=DM+Sans:wght@300;400;500;700&family=Dancing+Script:wght@400;700&family=Fira+Code:wght@400;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700;800&family=Lato:wght@400;700&family=Manrope:wght@400;500;700&family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;600;700&family=Oswald:wght@400;500;700&family=Pacifico&family=Playfair+Display:wght@400;600;700&family=Poppins:wght@400;500;600;700&family=Raleway:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Sora:wght@400;500;700&family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&family=Syne:wght@400;500;600;700;800&family=Ubuntu:wght@400;500;700&display=swap"
        />
        <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" />
      </head>
      <body className={`${inter.variable} ${spaceMono.variable} ${spaceGrotesk.variable} ${roboto.variable} ${sourceSans3.variable} ${quicksand.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" enableSystem={false}>
          <AccountStatusGuard />
          {children}
          <Toaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
