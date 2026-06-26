import Link from 'next/link'
import './halo-theme.css'
import './halo-theme-refined.css'
import { ArrowRight, Check, Minus } from 'lucide-react'
import { getCurrentProfileSummary } from '@/lib/current-profile'
import {
  ScrollReveal,
  GlowOrbs,
  GridPattern,
  ParallaxStars,
} from '@/components/landing/hero-animations'
import { ProfileCardPreview } from '@/components/landing/profile-card-preview'
import { FeatureRow } from '@/components/landing/feature-row'
import { DecorationStrip } from '@/components/landing/decoration-strip'
import { FeaturedProfile } from '@/components/landing/featured-profile'
import { getFeaturedProfiles } from '@/lib/landing/featured-profiles'
import { PLATFORMS, PLATFORM_ICON_PATHS } from '@/lib/landing/platforms'
import { MobileNav } from '@/components/landing/mobile-nav'

// Nav renders 'sign in / claim handle' for guests and 'dashboard / my profile'
// for logged-in users, so the page must be per-request - no CDN caching.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const [profile, featured] = await Promise.all([
    getCurrentProfileSummary(),
    getFeaturedProfiles(),
  ])

  return (
    <div className="halo-theme">
      <ParallaxStars />
      <GlowOrbs />

      {/* ──────── Nav ──────── */}
      <nav className="navbar">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" style={{ height: 26, width: 'auto', marginRight: 8, verticalAlign: 'middle' }} />
            <span className="logo-halo">halo</span>
            <span className="logo-dot">.</span>
            <span className="logo-rip">rip</span>
          </Link>
          <span className="nav-divider">/</span>
          <ul className="nav-links">
            <li><Link href="#features" className="nav-link">features</Link></li>
            <li><Link href="/pricing" className="nav-link">premium</Link></li>
            <li><Link href="/leaderboard" className="nav-link">leaderboards</Link></li>
            <li><a href="https://discord.gg/NgVh45gXbD" target="_blank" rel="noreferrer" className="nav-link">discord</a></li>
          </ul>
          <div className="nav-auth">
            {profile ? (
              <div className="nav-auth-actions">
                <Link href="/dashboard" className="btn btn-ghost nav-auth-btn">dashboard</Link>
                <Link href={`/${profile.username}`} className="btn btn-primary nav-auth-btn">my profile</Link>
              </div>
            ) : (
              <div className="nav-auth-actions">
                <Link href="/login" className="btn btn-ghost nav-auth-btn">sign in</Link>
                <Link href="/signup" className="btn btn-primary nav-auth-btn">claim handle</Link>
              </div>
            )}
          </div>
          <MobileNav username={profile?.username ?? null} />
        </div>
      </nav>

      {/* ──────── Hero ──────── */}
      <section className="hero hero-split">
        <div className="hero-glow" />
        <GridPattern />

        <div className="hero-split-inner">
          <div className="hero-content hero-content-left">
            <h1 className="hero-title">
              your link.<br />
              <span className="hero-rotator" aria-label="hit different">
                <span className="hero-rotator-word hero-title-gradient" style={{ animationDelay: '0s' }}>hit different.</span>
                <span className="hero-rotator-word hero-title-gradient" style={{ animationDelay: '3s' }}>goes hard.</span>
                <span className="hero-rotator-word hero-title-gradient" style={{ animationDelay: '6s' }}>looks fire.</span>
                <span className="hero-rotator-word hero-title-gradient" style={{ animationDelay: '9s' }}>one of one.</span>
              </span>
            </h1>

            <p className="hero-sub">
              halo.rip lets you upload your music, run a video background, plug in your live discord status, stack cursor effects, and pick from 600+ animated avatar decorations. one link, your whole internet.
            </p>

            <div className="claim-strip-wrapper">
              <form action="/signup" method="get" className="claim-row">
                <div className="claim-frame">
                  <span className="claim-prefix">halo.rip/</span>
                  <input type="text" name="username" placeholder="yourname" className="claim-input" autoComplete="off" />
                </div>
                <button type="submit" className="btn btn-primary claim-btn">
                  claim
                  <ArrowRight size={15} />
                </button>
              </form>
            </div>

          </div>

          {/* Right: tilted product mockup with pink stroke */}
          <div className="hero-mockup-container">
            <div className="hero-mockup-aura" />
            <div className="hero-mockup-inner">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-mockup-v2.png"
                alt="halo.rip profile editor preview"
                className="hero-mockup-img"
                width={1919}
                height={1079}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ──────── Profile of the Day ──────── */}
      <section className="hp-potd">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-text">
              <span className="section-eyebrow">profile of the day</span>
              <h2 className="section-title">today&apos;s most-viewed.</h2>
              <p className="section-sub">
                picked daily from yesterday&apos;s top profile. tomorrow it could be yours.
              </p>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={60}>
            <FeaturedProfile />
          </ScrollReveal>
        </div>
      </section>

      {/* ──────── Live profile gallery ──────── */}
      <section id="showcase" className="hp-showcase">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-text">
              <span className="section-eyebrow">live on halo.rip</span>
              <h2 className="section-title">real profiles. real people.</h2>
              <p className="section-sub">
                six of them are below. click any card to open the actual profile. backgrounds play, music plays, widgets update.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={60}>
            <div className="hp-showcase-grid">
              {featured.map((p) => (
                <ProfileCardPreview key={p.id} profile={p} />
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ──────── Feature spotlights ──────── */}
      <section id="features" className="hp-features">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-text">
              <span className="section-eyebrow">what&apos;s in the box</span>
              <h2 className="section-title">not another linktree.</h2>
              <p className="section-sub">
                halo.rip is a full profile builder. themes, music, widgets, decorations, effects. yours, not a template.
              </p>
            </div>
          </ScrollReveal>

          <div className="hp-features-stack">
            <ScrollReveal>
              <FeatureRow
                eyebrow="themes & backgrounds"
                title="any color, any background."
                body={
                  <>
                    <p>upload a video, gif, image, or pick a solid. swap the font, accent, card opacity, border radius. preview live, no save button.</p>
                    <p className="hp-feature-list">
                      <span>video bg</span><span>gif bg</span><span>image bg</span><span>solid</span><span>any font</span>
                    </p>
                  </>
                }
                visual={
                  <div className="hp-bg-collage">
                    {featured.slice(0, 4).map((p) => {
                      const bgStyle: React.CSSProperties = {
                        background: p.background_color || '#0a0a0f',
                      }
                      const isVideo = p.background_url && /\.(mp4|webm|mov)(\?|$)/i.test(p.background_url)
                      const bgImage = p.background_url && !isVideo ? p.background_url : null
                      return (
                        <div key={p.id} className="hp-bg-tile" style={bgStyle}>
                          {bgImage && (
                            <div
                              className="hp-bg-tile-img"
                              style={{ backgroundImage: `url("${bgImage.replace(/"/g, '%22')}")` }}
                              aria-hidden
                            />
                          )}
                          {isVideo && p.background_url && (
                            <video src={p.background_url} autoPlay muted loop playsInline preload="metadata" aria-hidden />
                          )}
                          <div className="hp-bg-tile-label">/{p.username}</div>
                        </div>
                      )
                    })}
                  </div>
                }
                side="right"
              />
            </ScrollReveal>

            <ScrollReveal>
              <FeatureRow
                eyebrow="600+ animated avatar decorations"
                title="discord-store decorations, free."
                body={
                  <>
                    <p>every discord avatar decoration, mirrored and free for every halo.rip profile. cat ears, halos, crystal elks, the whole catalog.</p>
                    <p>no other bio-link site has this. it&apos;s the single thing buyers (and creators) keep coming back for.</p>
                  </>
                }
                visual={<DecorationStrip />}
                side="left"
              />
            </ScrollReveal>

            <ScrollReveal>
              <FeatureRow
                eyebrow="music, widgets, effects"
                title="the profile is alive."
                body={
                  <>
                    <p>auto-play music on open (mp3, mp4, youtube, soundcloud). live discord status that updates while visitors watch. last.fm now-playing, roblox presence, valorant rank.</p>
                    <p>50+ cursor and page effects you can stack: spark trail, ghost trail, sparkles, glitch text, typewriter, snow, aurora.</p>
                  </>
                }
                visual={
                  <div className="hp-widget-stack">
                    <div className="hp-widget hp-widget-music">
                      <div className="hp-widget-icon" style={{ background: '#1DB954' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" style={{ fill: '#fff' }}><path d={PLATFORM_ICON_PATHS.spotify} /></svg>
                      </div>
                      <div className="hp-widget-body">
                        <div className="hp-widget-label">now playing</div>
                        <div className="hp-widget-title">tuuff <span>· rez</span></div>
                      </div>
                      <div className="hp-widget-eq" aria-hidden>
                        <span /><span /><span /><span />
                      </div>
                    </div>
                    <div className="hp-widget hp-widget-discord">
                      <div className="hp-widget-icon" style={{ background: '#5865F2' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" style={{ fill: '#fff' }}><path d={PLATFORM_ICON_PATHS.discord} /></svg>
                      </div>
                      <div className="hp-widget-body">
                        <div className="hp-widget-label">discord · online</div>
                        <div className="hp-widget-title">playing valorant</div>
                      </div>
                      <span className="hp-widget-pulse" aria-hidden />
                    </div>
                    <div className="hp-widget hp-widget-effect">
                      <div className="hp-widget-eyebrow">cursor effect</div>
                      <div className="hp-widget-effect-row">
                        <span>ghost trail</span><span>spark trail</span><span>cat</span><span>glow</span>
                      </div>
                    </div>
                  </div>
                }
                side="right"
              />
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ──────── Compare ──────── */}
      <section className="compare-section">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-text">
              <span className="section-eyebrow">vs. the rest</span>
              <h2 className="section-title">it&apos;s a different product.</h2>
              <p className="section-sub">
                feature claims verified against each competitor&apos;s current public pricing page (nov 2026).
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={60}>
            <div className="compare-table-wrap">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th className="compare-th compare-th-feature">feature</th>
                    <th className="compare-th compare-th-us"><span className="compare-brand">halo.rip</span></th>
                    <th className="compare-th compare-th-them">linktree</th>
                    <th className="compare-th compare-th-them">guns.lol</th>
                    <th className="compare-th compare-th-them">beacons</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="compare-feature">video / gif profile background</td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                  </tr>
                  <tr>
                    <td className="compare-feature">auto-play music on open</td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                  </tr>
                  <tr>
                    <td className="compare-feature">live discord status widget</td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                  </tr>
                  <tr>
                    <td className="compare-feature">animated avatar decorations</td>
                    <td className="compare-cell compare-yes">600+</td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                  </tr>
                  <tr>
                    <td className="compare-feature">stackable cursor + page effects</td>
                    <td className="compare-cell compare-yes">50+</td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-no"><Minus size={16} /></td>
                  </tr>
                  <tr>
                    <td className="compare-feature">custom fonts &amp; full theming</td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-partial">paid</td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-partial">paid</td>
                  </tr>
                  <tr>
                    <td className="compare-feature">free tier with all core features</td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-partial">limited</td>
                    <td className="compare-cell compare-yes"><Check size={16} strokeWidth={2.5} /></td>
                    <td className="compare-cell compare-partial">limited</td>
                  </tr>
                  <tr className="compare-row-price">
                    <td className="compare-feature">premium pricing</td>
                    <td className="compare-cell compare-price-us">$5 <span>lifetime</span></td>
                    <td className="compare-cell compare-price-them">$5–24 <span>/mo</span></td>
                    <td className="compare-cell compare-price-them">€7,99 <span>lifetime</span></td>
                    <td className="compare-cell compare-price-them">$10–90 <span>/mo</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ──────── Pricing ──────── */}
      <section className="hp-pricing">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-text">
              <span className="section-eyebrow">pricing</span>
              <h2 className="section-title">two plans. one of them is free.</h2>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={80}>
            <div className="hp-pricing-grid">
              <div className="hp-pricing-card">
                <div className="hp-pricing-tag">free</div>
                <div className="hp-pricing-price">$0<span>/ forever</span></div>
                <ul className="hp-pricing-list">
                  <li>your own halo.rip/handle</li>
                  <li>themes, music, backgrounds</li>
                  <li>20+ effects &amp; cursors</li>
                  <li>live discord / spotify widgets</li>
                  <li>profile analytics</li>
                </ul>
                <Link href="/signup" className="btn btn-ghost hp-pricing-btn">claim handle</Link>
              </div>

              <div className="hp-pricing-card hp-pricing-card-premium">
                <div className="hp-pricing-tag hp-pricing-tag-premium">premium · pay once</div>
                <div className="hp-pricing-price">$5<span>/ lifetime</span></div>
                <ul className="hp-pricing-list">
                  <li>everything in free, plus:</li>
                  <li>30+ premium effects &amp; widgets</li>
                  <li>animated avatar decorations</li>
                  <li>custom font upload</li>
                  <li>premium badge on profile</li>
                  <li>future premium features included</li>
                </ul>
                <Link href="/pricing" className="btn btn-primary hp-pricing-btn">go premium · $5</Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ──────── FAQ ──────── */}
      <section className="faq-section">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-text">
              <span className="section-eyebrow">faq</span>
              <h2 className="section-title">stuff people ask.</h2>
            </div>
          </ScrollReveal>

          <div className="faq-grid">
            <ScrollReveal>
              <details className="faq-item">
                <summary className="faq-q">
                  <span>is it actually free?</span>
                  <span className="faq-toggle" aria-hidden>+</span>
                </summary>
                <p className="faq-a">
                  yeah. free covers your link, themes, music, backgrounds, widgets, 20+ effects, and analytics. premium ($5 one-time) adds 30+ extra effects, animated avatar decorations, custom fonts, and the premium badge.
                </p>
              </details>
            </ScrollReveal>

            <ScrollReveal>
              <details className="faq-item">
                <summary className="faq-q">
                  <span>$5 once, really? what&apos;s the catch?</span>
                  <span className="faq-toggle" aria-hidden>+</span>
                </summary>
                <p className="faq-a">
                  no catch. one $5 payment, premium forever. we hate monthly subscriptions too. you get the premium badge auto-equipped, every locked effect, animated decorations, custom fonts, and any premium feature we ship in the future.
                </p>
              </details>
            </ScrollReveal>

            <ScrollReveal>
              <details className="faq-item">
                <summary className="faq-q">
                  <span>can i change my username later?</span>
                  <span className="faq-toggle" aria-hidden>+</span>
                </summary>
                <p className="faq-a">
                  yes, from your dashboard. usernames are unique; if someone&apos;s already taken yours, you&apos;ll need a different one. claim early.
                </p>
              </details>
            </ScrollReveal>

            <ScrollReveal>
              <details className="faq-item">
                <summary className="faq-q">
                  <span>does music auto-play on iphone?</span>
                  <span className="faq-toggle" aria-hidden>+</span>
                </summary>
                <p className="faq-a">
                  ios safari blocks autoplay until the user taps. we show a clean &ldquo;click to enter&rdquo; splash that doubles as the unlock. one tap and music starts.
                </p>
              </details>
            </ScrollReveal>

            <ScrollReveal>
              <details className="faq-item">
                <summary className="faq-q">
                  <span>can i upload my own video / fonts / icons?</span>
                  <span className="faq-toggle" aria-hidden>+</span>
                </summary>
                <p className="faq-a">
                  yes. background videos (up to 25 mb, we compress automatically), custom fonts (premium), custom button icons. the transcoder keeps videos sharp without nuking visitors&apos; data.
                </p>
              </details>
            </ScrollReveal>

            <ScrollReveal>
              <details className="faq-item">
                <summary className="faq-q">
                  <span>how is this different from guns.lol?</span>
                  <span className="faq-toggle" aria-hidden>+</span>
                </summary>
                <p className="faq-a">
                  closest competitor. the headline difference: 600+ animated avatar decorations that work natively, plus our premium is $5 vs their €7,99. also faster on mobile since we transcode every uploaded video instead of serving raw mp4s.
                </p>
              </details>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ──────── Platforms marquee ──────── */}
      <section className="platforms-section">
        <div className="section-inner">
          <ScrollReveal>
            <div className="section-text">
              <span className="section-eyebrow">26 platforms · auto icons</span>
              <h2 className="section-title">everywhere you already are.</h2>
              <p className="section-sub">
                paste a username; we handle the icon, the color, and the link. zero setup.
              </p>
            </div>
          </ScrollReveal>
        </div>

        <div className="platforms-marquee-outer">
          <div className="platforms-marquee-track track-fwd">
            {[...PLATFORMS, ...PLATFORMS, ...PLATFORMS, ...PLATFORMS].map((p, i) => (
              <div key={i} className="platform-chip" style={{ '--chip-color': p.color, '--chip-bg': p.bg } as never}>
                <span className="platform-chip-icon">
                  <svg viewBox="0 0 24 24" width="14" height="14" style={{ fill: p.color, display: 'block', flexShrink: 0 }}>
                    <path d={PLATFORM_ICON_PATHS[p.key]} />
                  </svg>
                </span>
                <span className="platform-chip-label">{p.label}</span>
              </div>
            ))}
          </div>
          <div className="platforms-marquee-track track-rev">
            {[...PLATFORMS.slice().reverse(), ...PLATFORMS.slice().reverse(), ...PLATFORMS.slice().reverse(), ...PLATFORMS.slice().reverse()].map((p, i) => (
              <div key={i} className="platform-chip" style={{ '--chip-color': p.color, '--chip-bg': p.bg } as never}>
                <span className="platform-chip-icon">
                  <svg viewBox="0 0 24 24" width="14" height="14" style={{ fill: p.color, display: 'block', flexShrink: 0 }}>
                    <path d={PLATFORM_ICON_PATHS[p.key]} />
                  </svg>
                </span>
                <span className="platform-chip-label">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────── Final CTA ──────── */}
      <section className="hp-final-cta">
        <div className="section-inner">
          <ScrollReveal>
            <div className="hp-final-inner">
              <h2 className="hp-final-title">
                ready to make<br />
                <span className="hero-title-gradient">yours different?</span>
              </h2>
              <p className="hp-final-sub">free to claim. 60 seconds to live. no card, no trial, no catch.</p>
              <div className="hp-final-actions">
                <Link href="/signup" className="btn btn-primary btn-lg">
                  claim halo.rip/yourname
                  <ArrowRight size={17} />
                </Link>
                <a href="https://discord.gg/NgVh45gXbD" target="_blank" rel="noreferrer" className="btn btn-ghost btn-lg">
                  join the discord
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ──────── Footer ──────── */}
      <footer className="site-footer">
        <div className="section-inner">
          <div className="footer-inner">
            <div className="footer-brand">
              <Link href="/" className="nav-logo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" style={{ height: 24, width: 'auto', marginRight: 8, verticalAlign: 'middle' }} />
                <span className="logo-halo">halo</span>
                <span className="logo-dot">.</span>
                <span className="logo-rip">rip</span>
              </Link>
              <p className="footer-tagline">one link. zero limits.</p>
              <p className="footer-meta">est. 2024 · made in the discord</p>
            </div>
            <div className="footer-links-group">
              <div className="footer-col">
                <h4 className="footer-col-title">the site</h4>
                <Link href="#features" className="footer-link">features</Link>
                <Link href="/pricing" className="footer-link">premium</Link>
                <Link href="/leaderboard" className="footer-link">leaderboards</Link>
                <Link href="/rez" className="footer-link">demo profile</Link>
              </div>
              <div className="footer-col">
                <h4 className="footer-col-title">join in</h4>
                <a href="https://discord.gg/NgVh45gXbD" target="_blank" rel="noreferrer" className="footer-link">discord</a>
                <Link href="/login" className="footer-link">sign in</Link>
                <Link href="/signup" className="footer-link">claim handle</Link>
              </div>
              <div className="footer-col">
                <h4 className="footer-col-title">the boring stuff</h4>
                <Link href="/privacy" className="footer-link">privacy</Link>
                <Link href="/tos" className="footer-link">terms</Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-credit">made by <span className="footer-rez">rez</span> · halo.rip © 2024</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
