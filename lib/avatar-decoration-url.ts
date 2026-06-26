// Tiny helper exported separately from the full catalog so profile pages
// (which only need to BUILD a URL from a stored slug) don't pull in the
// 2,500-line GENERATED_DECORATIONS array. The dashboard picker still
// imports the full catalog via lib/avatar-decorations.ts.
//
// Assets are SELF-HOSTED under /decorations/ (served by nginx directly from
// the server's upload volume - see the `location /decorations/` block in
// /etc/nginx/sites-available/halo, alias /var/lib/halo-uploads/decorations/).
//
// We used to pull these from a community jsdelivr mirror
// (Kadantte/discord-fake-avatar-decorations), but Discord DMCA'd that entire
// repo family in late 2025, so we host our own copy. This makes the
// decoration catalog immune to upstream takedowns.

export const DECOR_CDN = '/decorations'

/** URL for the decoration's animated APNG asset. */
export function decorationUrl(slug: string): string {
  return `${DECOR_CDN}/${slug}.png`
}
