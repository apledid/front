# Patch Notes - v17 (Major UI Overhaul)

## Landing Page - Complete Redesign
- **guns.lol / feds.lol inspired design**: ultra-dark background (#06060b), subtle grid overlay, animated gradient blurs
- **Claim username widget**: "links.me/yourname" input with claim button, routes to signup with username pre-filled
- **Animated stat counters**: scroll-triggered counters (profile views, users, links created, subscribers)
- **Feature cards grid**: 8 feature cards with hover effects and icon highlights
- **Pricing section**: Free vs Premium comparison with "POPULAR" badge, lifetime pricing
- **Mobile hamburger menu**: animated burger icon with slide-down menu
- **Repeated CTA**: claim username widget at bottom of page

## Login & Signup Pages
- **Removed landing background component dependency**: standalone gradient blur backgrounds
- **Cleaner input styling**: rounded-xl inputs with subtle borders, uppercase tracking labels
- **Pre-fill username from URL**: signup page reads `?username=` param from claim widget
- **Refined error states**: red-tinted error cards with border

## Profile View - Major Upgrade
- **Ambient glow**: dynamic glow blurs based on user's accent color
- **Accent line at top of card**: gradient line using accent color
- **Online indicator**: green dot on avatar
- **Pill-shaped stats**: view count and location in rounded bg containers
- **Audio visualizer**: animated bars when music is playing
- **Refined progress bar**: custom progress bar replacing range input
- **Badge tooltips**: hover to see badge name
- **Button hover effects**: dynamic background/border/shadow changes
- **"Powered by links.me" watermark**: subtle branding at bottom

## Dashboard
- **New background**: #06060b consistent throughout
- **Sidebar redesign**: thinner border lines (white/4%), menu category label, active dot indicator, gradient logo
- **Header redesign**: compact 14px height, blurred background, refined dropdown menu
- **Overview page**: gradient stat cards with color coding, 6 quick action cards with arrow icons
- **Profile URL card**: gradient background with copy/view buttons

## Global CSS Updates
- **New animation**: `animate-pulse-slow` for ambient blurs, `animate-glow-pulse`, `audioBar` keyframes
- **Darker color scheme**: background #06060b, card #0c0c14, borders rgba(255,255,255,0.06)
- **Refined scrollbar**: thinner 6px width, subtler colors
- **Font smoothing**: antialiased rendering enabled

## New Database Features (Migration 020)
- **Discord presence**: `discord_presence_enabled`, `discord_user_id`
- **SEO metadata**: `seo_title`, `seo_description`, `seo_image_url`
- **Theme presets**: `theme_preset` column + `profile_themes` table for community templates
- **Profile layouts**: `profile_layout` (compact/standard/expanded)
- **Audio visualizer toggle**: `audio_visualizer_enabled`
- **Avatar border styles**: `avatar_border_style`
- **Card customization**: `card_blur_amount`, `bg_overlay_opacity`
- **Custom CSS**: `custom_css` (premium feature)
- **Page title**: `page_title` for browser tab
- **Visitor logs table**: advanced analytics with device, browser, OS, city tracking

## Branding
- **New logo**: Zap icon in purple-to-fuchsia gradient square
- **Consistent naming**: "links.me" with purple accent on ".me"
- **Updated metadata**: better SEO title and description
