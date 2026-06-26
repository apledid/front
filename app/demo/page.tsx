import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GunsProfile } from '@/components/profile/guns-profile'
import type { Profile, SocialLink, CustomButton, Badge } from '@/lib/types'

const demoProfile = {
  id: 'demo-profile',
  user_id: 'demo-user',
  username: 'demo',
  display_name: 'Demo User',
  bio: 'This is the demo profile while @rez is not created yet.',
  avatar_url: null,
  accent_color: '#06b6d4',
  text_color: '#ffffff',
  background_color: '#0f0f23',
  icon_color: '#06b6d4',
  font_family: 'Inter',
  card_style: 'glass',
  border_style: 'glow',
  background_effect: 'aurora',
  profile_opacity: 100,
  profile_blur: 18,
  glow_username: true,
  glow_socials: true,
  glow_badges: true,
  glow_intensity: 70,
  glow_color: '#00d9ff',
  show_view_count: true,
  show_badges: true,
  panel_size: 'medium',
  avatar_position: 'center',
  avatar_placement: 'outside',
  show_avatar: true,
  show_name: true,
  typing_bio: false,
  bio_texts: [],
  music_enabled: false,
  view_count: 12847,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as Profile

const demoSocialLinks: SocialLink[] = [
  { id: '1', user_id: 'demo-user', platform: 'discord', url: 'https://discord.com', display_order: 0, created_at: '' },
  { id: '2', user_id: 'demo-user', platform: 'github', url: 'https://github.com', display_order: 1, created_at: '' },
  { id: '3', user_id: 'demo-user', platform: 'twitter', url: 'https://x.com', display_order: 2, created_at: '' },
]

const demoButtons: CustomButton[] = [
  { id: '1', user_id: 'demo-user', label: 'Portfolio', url: 'https://example.com', bg_color: '#00d9ff', text_color: '#001018', media_url: null, media_type: null, display_order: 0, created_at: '' },
]

const demoBadges: Badge[] = [
  { id: '1', name: 'OG', description: 'Early adopter', icon: 'star', color: '#FFD700', created_at: '' },
]

export default async function DemoPage() {
  const supabase = await createClient()
  const { data: rezProfile } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', 'rez')
    .maybeSingle()

  if (rezProfile?.username) redirect('/rez')

  return <GunsProfile profile={demoProfile} socialLinks={demoSocialLinks} badges={demoBadges} customButtons={demoButtons} />
}
