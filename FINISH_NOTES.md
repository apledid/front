# Halo merge finish notes

## Added in this pass
- Dashboard sidebar dropdowns for **Overview** and **Settings**
- New **Premium** dashboard tab with key listing, copy, auto redeem, and manual redeem
- New **Inbox** dashboard tab for site mail and purchased keys
- Mock **pricing checkout flow** with:
  - Subscribe / Purchase labels
  - confirmation step
  - card / PayPal / crypto tabs
  - dashboard redirect after purchase
- New **staff license gate** on `/dashboard/admin`
- Rebuilt **staff panel** with:
  - Overview
  - Moderate
  - Licenses
  - Troll Auth
  - Achivements
- Added **ban**, **support blacklist**, **staff inbox messaging**, **badge/title assignment**, **license visibility**, **username swap**, **profile picture swap**, **bio changes**, and **UID changes**
- Added **badge/title equipment editor** to the user profile page
- Added **public profile badge/title positions**:
  - above username
  - below username
  - above links
  - below links
- Adjusted **sparkle username effects** so sparkles render behind the display name
- Smoothed the profile card shell radius
- Updated homepage copy for **Profile suite**, **Team**, **Sun**, and the new storefront text

## Payment note
The pricing flow is intentionally **UI-only** right now. It creates a local mock purchase and key delivery through the internal project routes, but it does **not** connect to real card, PayPal, or crypto APIs yet.

## Database work
Run the new migration before testing these features:
- `scripts/021_halo_premium_staff.sql`

## Main routes to test
- `/pricing`
- `/dashboard/premium`
- `/dashboard/inbox`
- `/dashboard/admin`
- `/dashboard/profile`
- `/:username`
