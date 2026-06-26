'use client'

import { useCallback, useRef, useState } from 'react'
import { IconAward, IconLoader2, IconPalette, IconRotate2, IconAdjustments } from '@tabler/icons-react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Profile } from '@/lib/types'

interface Badge {
  id: string
  name: string
  icon: string
  icon_url: string | null
  color: string | null
  glow_color: string | null
  glow_strength: number | null
  description: string | null
}

// Inline badge SVG renderer (mirrors the one in guns-profile.tsx)
function BadgeIcon({ name, className = 'h-6 w-6' }: { name: string; className?: string }) {
  const k = (name || '').toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')

  if (k === 'rank-1') return (
    <svg className={className} viewBox="2 2 20 20.75" fill="currentColor">
      <g fill="currentColor">
        <path d="M22 8.162v.073c0 .86 0 1.291-.207 1.643c-.207.352-.584.561-1.336.98l-.793.44c.546-1.848.729-3.834.796-5.532l.01-.221l.002-.052c.651.226 1.017.395 1.245.711c.283.393.283.915.283 1.958Zm-20 0v.073c0 .86 0 1.291.207 1.643c.207.352.584.561 1.336.98l.794.44c-.547-1.848-.73-3.834-.797-5.532l-.01-.221l-.001-.052c-.652.226-1.018.395-1.246.711C2 6.597 2 7.12 2 8.162Z"/>
        <path fillRule="evenodd" d="M16.377 2.347A26.373 26.373 0 0 0 12 2c-1.783 0-3.253.157-4.377.347c-1.139.192-1.708.288-2.184.874c-.475.586-.45 1.219-.4 2.485c.173 4.348 1.111 9.78 6.211 10.26V19.5H9.82a1 1 0 0 0-.98.804l-.19.946H6a.75.75 0 0 0 0 1.5h12a.75.75 0 0 0 0-1.5h-2.65l-.19-.946a1 1 0 0 0-.98-.804h-1.43v-3.534c5.1-.48 6.039-5.911 6.211-10.26c.05-1.266.076-1.9-.4-2.485c-.476-.586-1.045-.682-2.184-.874Zm-3.59 3.46a.75.75 0 0 1 .463.693v4a.75.75 0 0 1-1.5 0V8.31l-.22.22a.75.75 0 1 1-1.06-1.06l1.5-1.5a.75.75 0 0 1 .817-.163Z" clipRule="evenodd"/>
      </g>
    </svg>
  )
  if (k === 'rank-2' || k === 'rank-3') {
    const n = k.slice(-1)
    return (
      <svg className={className} viewBox="4 1 16 21" fill="currentColor">
        <path opacity=".5" d="M9.3 13.2 7 21l2.6-1.5L11.5 21l-1-7.2zm5.4 0L17 21l-2.6-1.5L12.5 21l1-7.2z"/>
        <circle cx="12" cy="9" r="7"/>
        <text x="12" y="9" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fontWeight="800" fill="#0b0b10">{n}</text>
      </svg>
    )
  }

  if (k === 'owner') return (
    <svg className={className} viewBox="0 0 640 640" fill="currentColor"><path d="M345 151.2C354.2 143.9 360 132.6 360 120C360 97.9 342.1 80 320 80C297.9 80 280 97.9 280 120C280 132.6 285.9 143.9 295 151.2L226.6 258.8C216.6 274.5 195.3 278.4 180.4 267.2L120.9 222.7C125.4 216.3 128 208.4 128 200C128 177.9 110.1 160 88 160C65.9 160 48 177.9 48 200C48 221.8 65.5 239.6 87.2 240L119.8 457.5C124.5 488.8 151.4 512 183.1 512L456.9 512C488.6 512 515.5 488.8 520.2 457.5L552.8 240C574.5 239.6 592 221.8 592 200C592 177.9 574.1 160 552 160C529.9 160 512 177.9 512 200C512 208.4 514.6 216.3 519.1 222.7L459.7 267.3C444.8 278.5 423.5 274.6 413.5 258.9L345 151.2z"/></svg>
  )
  if (k === 'staff') return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.604 4.604C9.34 2.868 10.208 2 11.286 2c1.079 0 1.947.868 3.682 2.604l4.42 4.419c1.735 1.735 2.603 2.603 2.603 3.682s-.868 1.946-2.604 3.682s-2.604 2.604-3.682 2.604c-1.079 0-1.947-.868-3.682-2.604l-4.42-4.419C5.869 10.233 5 9.365 5 8.286s.868-1.946 2.604-3.682"/>
      <path opacity=".5" d="m8.345 12.71l-5.52 5.518c-.342.343-.513.514-.616.692a1.56 1.56 0 0 0 0 1.562c.103.178.274.35.617.692s.513.514.692.617a1.56 1.56 0 0 0 1.562 0c.178-.103.35-.275.692-.617l5.518-5.519zm10.31-4.42l.373-.372c.342-.343.514-.514.617-.692a1.56 1.56 0 0 0 0-1.562c-.103-.179-.275-.35-.617-.692c-.342-.343-.514-.514-.692-.617a1.56 1.56 0 0 0-1.562 0c-.178.103-.35.274-.692.617l-.373.373z"/>
    </svg>
  )
  if (k === 'verified' || k === 'badge-check') return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path opacity=".5" d="M9.592 3.2a6 6 0 0 1-.495.399c-.298.2-.633.338-.985.408c-.153.03-.313.043-.632.068c-.801.064-1.202.096-1.536.214a2.71 2.71 0 0 0-1.655 1.655c-.118.334-.15.735-.214 1.536a6 6 0 0 1-.068.632c-.07.352-.208.687-.408.985c-.087.13-.191.252-.399.495c-.521.612-.782.918-.935 1.238c-.353.74-.353 1.6 0 2.34c.153.32.414.626.935 1.238c.208.243.312.365.399.495c.2.298.338.633.408.985c.03.153.043.313.068.632c.064.801.096 1.202.214 1.536a2.71 2.71 0 0 0 1.655 1.655c.334.118.735.15 1.536.214c.319.025.479.038.632.068c.352.07.687.209.985.408c.13.087.252.191.495.399c.612.521.918.782 1.238.935c.74.353 1.6.353 2.34 0c.32-.153.626-.414 1.238-.935c.243-.208.365-.312.495-.399c.298-.2.633-.338.985-.408c.153-.03.313-.043.632-.068c.801-.064 1.202-.096 1.536-.214a2.71 2.71 0 0 0 1.655-1.655c.118-.334.15-.735.214-1.536c.025-.319.038-.479.068-.632c.07-.352.209-.687.408-.985c.087-.13.191-.252.399-.495c.521-.612.782-.918.935-1.238c.353-.74.353-1.6 0-2.34c-.153-.32-.414-.626-.935-1.238a6 6 0 0 1-.399-.495a2.7 2.7 0 0 1-.408-.985a6 6 0 0 1-.068-.632c-.064-.801-.096-1.202-.214-1.536a2.71 2.71 0 0 0-1.655-1.655c-.334-.118-.735-.15-1.536-.214a6 6 0 0 1-.632-.068a2.7 2.7 0 0 1-.985-.408a6 6 0 0 1-.495-.399c-.612-.521-.918-.782-1.238-.935a2.71 2.71 0 0 0-2.34 0c-.32.153-.626.414-1.238.935"/>
      <path d="M16.374 9.863a.814.814 0 0 0-1.151-1.151l-4.85 4.85l-1.595-1.595a.814.814 0 0 0-1.151 1.151l2.17 2.17a.814.814 0 0 0 1.15 0z"/>
    </svg>
  )
  if (k === 'booster' || k === 'server-booster') return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path opacity=".3" d="M6.71 18.71c-.28.28-2.17.76-2.17.76s.47-1.88.76-2.17c.17-.19.42-.3.7-.3a1.003 1.003 0 0 1 .71 1.71m.7-7.88l-1.91-.82l1.97-1.97l1.44.29c-.57.83-1.08 1.7-1.5 2.5m6.58 7.67l-.82-1.91c.8-.42 1.67-.93 2.49-1.5l.29 1.44zm6-14.49S16.44 3.32 11.76 8c-1.32 1.32-2.4 3.38-2.73 4.04l2.93 2.93c.65-.32 2.71-1.4 4.04-2.73c4.68-4.68 3.99-8.23 3.99-8.23M15 11c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2"/>
      <path d="M6 15c-.83 0-1.58.34-2.12.88C2.7 17.06 2 22 2 22s4.94-.7 6.12-1.88A2.996 2.996 0 0 0 6 15m.71 3.71c-.28.28-2.17.76-2.17.76s.47-1.88.76-2.17c.17-.19.42-.3.7-.3a1.003 1.003 0 0 1 .71 1.71m10.71-5.06c6.36-6.36 4.24-11.31 4.24-11.31S16.71.22 10.35 6.58l-2.49-.5a2.03 2.03 0 0 0-1.81.55L2 10.69l5 2.14L11.17 17l2.14 5l4.05-4.05c.47-.47.68-1.15.55-1.81zM7.41 10.83l-1.91-.82l1.97-1.97l1.44.29c-.57.83-1.08 1.7-1.5 2.5m6.58 7.67l-.82-1.91c.8-.42 1.67-.93 2.49-1.5l.29 1.44zM16 12.24c-1.32 1.32-3.38 2.4-4.04 2.73l-2.93-2.93c.32-.65 1.4-2.71 2.73-4.04c4.68-4.68 8.23-3.99 8.23-3.99s.69 3.55-3.99 8.23M15 11c1.1 0 2-.9 2-2s-.9-2-2-2s-2 .9-2 2s.9 2 2 2"/>
    </svg>
  )
  if (k === 'og') return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor"><path d="M41 27.7v46h430v-46zm32 64v112.5l62 20.7V91.7zm80 0v139.2l79.3 26.4c-10.4 7.5-17.3 19.7-17.3 33.4c0 21 16.1 38.5 36.5 40.7l-22.3 43.7l-58.2 9.3l41.6 41.7l-9.1 58.2l52.5-26.7l52.5 26.7l-9.1-58.2l41.6-41.7l-58.2-9.3l-22.3-43.7c20.4-2.2 36.5-19.7 36.5-40.7c0-13.7-6.9-25.9-17.3-33.4l79.3-26.4V91.7h-94v159c-2.9-.6-5.9-1-9-1s-6.1.4-9 1v-159zm224 0v133.2l62-20.7V91.7zm-121 176c12.8 0 23 10.2 23 23s-10.2 23-23 23s-23-10.2-23-23s10.2-23 23-23"/></svg>
  )
  if (k === 'partner') return (
    <svg className={className} viewBox="0 0 256 256" fill="currentColor">
      <path opacity=".2" d="M232 102c0 66-104 122-104 122S24 168 24 102a54 54 0 0 1 54-54c22.59 0 41.94 12.31 50 32c8.06-19.69 27.41-32 50-32a54 54 0 0 1 54 54"/>
      <path d="M178 40c-20.65 0-38.73 8.88-50 23.89C116.73 48.88 98.65 40 78 40a62.07 62.07 0 0 0-62 62c0 70 103.79 126.66 108.21 129a8 8 0 0 0 7.58 0C136.21 228.66 240 172 240 102a62.07 62.07 0 0 0-62-62m-50 174.8c-18.26-10.64-96-59.11-96-112.8a46.06 46.06 0 0 1 46-46c19.45 0 35.78 10.36 42.6 27a8 8 0 0 0 14.8 0c6.82-16.67 23.15-27 42.6-27a46.06 46.06 0 0 1 46 46c0 53.61-77.76 102.15-96 112.8"/>
    </svg>
  )
  if (k === 'event-winner' || k === 'winner' || k === 'trophy') return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path opacity=".5" d="M12 16c-5.76 0-6.78-5.74-6.96-10.294c-.05-1.266-.076-1.9.4-2.485c.476-.586 1.045-.682 2.184-.874A26.4 26.4 0 0 1 12 2c1.783 0 3.253.157 4.377.347c1.138.192 1.708.288 2.183.874c.476.586.451 1.219.4 2.485C18.78 10.259 17.76 16 12 16"/>
      <path d="m17.64 12.422l2.817-1.565c.752-.418 1.128-.627 1.336-.979C22 9.526 22 9.096 22 8.235v-.073c0-1.043 0-1.565-.283-1.958s-.778-.558-1.768-.888L19 5l-.017.085q-.008.283-.022.621c-.088 2.225-.377 4.733-1.32 6.716M5.04 5.706c.087 2.225.376 4.733 1.32 6.716l-2.817-1.565c-.752-.418-1.129-.627-1.336-.979S2 9.096 2 8.235v-.073c0-1.043 0-1.565.283-1.958s.778-.558 1.768-.888L5 5l.017.087q.008.281.022.62"/>
      <path fillRule="evenodd" d="M5.25 22a.75.75 0 0 1 .75-.75h12a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75" clipRule="evenodd"/>
      <path opacity=".5" d="M15.458 21.25H8.543l.297-1.75a1 1 0 0 1 .98-.804h4.36a1 1 0 0 1 .981.804z"/>
      <path d="M12 16q-.39 0-.75-.034v2.73h1.5v-2.73A8 8 0 0 1 12 16m-.854-9.977C11.526 5.34 11.716 5 12 5s.474.34.854 1.023l.098.176c.108.194.162.29.246.354c.085.064.19.088.4.135l.19.044c.738.167 1.107.25 1.195.532s-.164.577-.667 1.165l-.13.152c-.143.167-.215.25-.247.354s-.021.215 0 .438l.02.203c.076.785.114 1.178-.115 1.352c-.23.174-.576.015-1.267-.303l-.178-.082c-.197-.09-.295-.135-.399-.135s-.202.045-.399.135l-.178.082c-.691.319-1.037.477-1.267.303s-.191-.567-.115-1.352l.02-.203c.021-.223.032-.334 0-.438s-.104-.187-.247-.354l-.13-.152c-.503-.588-.755-.882-.667-1.165c.088-.282.457-.365 1.195-.532l.19-.044c.21-.047.315-.07.4-.135c.084-.064.138-.16.246-.354z"/>
    </svg>
  )
  if (k === 'innovator') return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h1m8-9v1m8 8h1M5.6 5.6l.7.7m12.1-.7l-.7.7M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0-1 3a2 2 0 0 1-4 0a3.5 3.5 0 0 0-1-3m.7 1h4.6"/>
    </svg>
  )
  if (k === 'premium') return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="m9.367 19.08l-7.025-9.04h3.836zm5.987-9.04l-3.36 10.946L8.12 10.039zm6.28 0l-7.209 9.272l2.859-9.273zM22 8.206h-4.704l-1.43-5.192h2.652a.4.4 0 0 1 .257.183zm-6.597 0h-7.27l1.833-5.18h3.995zM8.011 3.039l-1.82 5.167H2L5.128 3.32l.097-.11a.5.5 0 0 1 .16-.123a.4.4 0 0 1 .17 0z"/>
    </svg>
  )
  if (k === 'donator' || k === 'donor') return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor"><path d="M327.027 65.816L229.79 128.23l9.856 5.397l86.51-55.53l146.735 83.116l-84.165 54.023l4.1 2.244v6.848l65.923-42.316l13.836 7.838l-79.76 51.195v11.723l64.633-41.487l15.127 8.57l-79.76 51.195v11.723l64.633-41.487l15.127 8.57l-79.76 51.195v11.723l100.033-64.21l-24.828-14.062l24.827-15.937l-24.828-14.064l24.827-15.937l-23.537-13.333l23.842-15.305zm31.067 44.74c-21.038 10.556-49.06 12.342-68.79 4.383l-38.57 24.757l126.903 69.47l36.582-23.48c-14.41-11.376-13.21-28.35 2.942-41.67zM227.504 147.5l-70.688 46.094l135.61 78.066l1.33-.85c2.5-1.61 6.03-3.89 10.242-6.613c8.42-5.443 19.563-12.66 30.674-19.86c16.002-10.37 24.248-15.72 31.916-20.694zm115.467 1.17a8.583 14.437 82.068 0 1 .003 0a8.583 14.437 82.068 0 1 8.32 1.945a8.583 14.437 82.068 0 1-.87 12.282a8.583 14.437 82.068 0 1-20.273 1.29a8.583 14.437 82.068 0 1 .87-12.28a8.583 14.437 82.068 0 1 11.95-3.237m-218.423 47.115L19.143 263.44l23.537 13.333l-23.842 15.305l24.828 14.063l-24.828 15.938l24.828 14.063l-24.828 15.938l166.135 94.106L285.277 381.8v-11.72l-99.433 63.824L39.11 350.787l14.255-9.15l131.608 74.547L285.277 351.8v-11.72l-99.433 63.824L39.11 320.787l14.255-9.15l131.608 74.547L285.277 321.8v-11.72l-99.433 63.824L39.11 290.787l13.27-8.52l132.9 75.28l99.997-64.188v-5.05l-5.48-3.154l-93.65 60.11l-146.73-83.116l94.76-60.824l-9.63-5.543zm20.46 11.78l-46.92 30.115c14.41 11.374 13.21 28.348-2.942 41.67l59.068 33.46c21.037-10.557 49.057-12.342 68.787-4.384l45.965-29.504l-123.96-71.358zm229.817 32.19c-8.044 5.217-15.138 9.822-30.363 19.688a36222 36222 0 0 1-30.69 19.873c-4.217 2.725-7.755 5.01-10.278 6.632c-.09.06-.127.08-.215.137v85.924l71.547-48.088zm-200.99 17.48a8.583 14.437 82.068 0 1 8.32 1.947a8.583 14.437 82.068 0 1-.87 12.28a8.583 14.437 82.068 0 1-20.27 1.29a8.583 14.437 82.068 0 1 .87-12.28a8.583 14.437 82.068 0 1 11.95-3.236z"/></svg>
  )
  if (k === 'bug-hunter' || k === 'bug') return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M19 8h-1.81a5.985 5.985 0 0 0-1.82-1.96l.93-.93a.996.996 0 1 0-1.41-1.41l-1.47 1.47C12.96 5.06 12.49 5 12 5s-.96.06-1.41.17L9.11 3.7A.996.996 0 1 0 7.7 5.11l.92.93C7.88 6.55 7.26 7.22 6.81 8H5c-.55 0-1 .45-1 1s.45 1 1 1h1.09c-.05.33-.09.66-.09 1v1H5c-.55 0-1 .45-1 1s.45 1 1 1h1v1c0 .34.04.67.09 1H5c-.55 0-1 .45-1 1s.45 1 1 1h1.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H19c.55 0 1-.45 1-1s-.45-1-1-1h-1.09c.05-.33.09-.66.09-1v-1h1c.55 0 1-.45 1-1s-.45-1-1-1h-1v-1c0-.34-.04-.67-.09-1H19c.55 0 1-.45 1-1s-.45-1-1-1m-6 8h-2c-.55 0-1-.45-1-1s.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1m0-4h-2c-.55 0-1-.45-1-1s.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1"/></svg>
  )
  if (k === 'gifter' || k === 'gift') return (
    <svg className={className} viewBox="2 2 16 16" fill="currentColor">
      <g>
        <path fillRule="evenodd" d="M14 6a2.5 2.5 0 0 0-4-3a2.5 2.5 0 0 0-4 3H3.25C2.56 6 2 6.56 2 7.25v.5C2 8.44 2.56 9 3.25 9h6V6h1.5v3h6C17.44 9 18 8.44 18 7.75v-.5C18 6.56 17.44 6 16.75 6zm-1-1.5a1 1 0 0 1-1 1h-1v-1a1 1 0 1 1 2 0m-6 0a1 1 0 0 0 1 1h1v-1a1 1 0 0 0-2 0" clipRule="evenodd"/>
        <path d="M9.25 10.5H3v4.75A2.75 2.75 0 0 0 5.75 18h3.5zm1.5 7.5v-7.5H17v4.75A2.75 2.75 0 0 1 14.25 18z"/>
      </g>
    </svg>
  )
  if (k === 'btc' || k === 'bitcoin') return (
    <svg className={className} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="btcBg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FBBF44"/><stop offset="55%" stopColor="#F7931A"/><stop offset="100%" stopColor="#B5660A"/></linearGradient>
        <radialGradient id="btcSheen2" cx="50%" cy="0%" r="65%"><stop offset="0%" stopColor="#fff" stopOpacity=".55"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#btcBg2)"/>
      <circle cx="12" cy="12" r="11" fill="url(#btcSheen2)"/>
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth=".4"/>
      <circle cx="12" cy="12" r="11" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth=".4"/>
      <g style={{ filter: 'drop-shadow(0 .5px .5px rgba(0,0,0,.25))' }}>
        <path fill="#fff" d="M15.93 10.79c.22-1.45-.89-2.23-2.41-2.75l.49-1.97-1.2-.3-.48 1.92q-.47-.12-.96-.22l.48-1.93-1.2-.3-.49 1.97q-.39-.09-.76-.17l-1.66-.41-.32 1.28s.89.2.87.22c.49.12.58.45.56.7l-1.37 5.49q-.09.21-.4.16c.02.02-.87-.22-.87-.22l-.6 1.38 1.57.39q.43.11.86.22l-.5 1.99 1.2.3.49-1.97.96.25-.49 1.97 1.2.3.5-1.99c2.05.39 3.6.23 4.25-1.62.52-1.49-.03-2.36-1.11-2.92.79-.18 1.39-.7 1.55-1.77zm-2.76 3.93c-.37 1.49-2.88.69-3.7.48l.66-2.65c.82.21 3.42.61 3.04 2.17m.37-3.96c-.34 1.36-2.43.66-3.11.49l.6-2.39c.69.17 2.88.48 2.51 1.9z"/>
      </g>
    </svg>
  )
  if (k === 'eth' || k === 'ethereum') return (
    <svg className={className} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="ethBg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9DB4FF"/><stop offset="55%" stopColor="#627EEA"/><stop offset="100%" stopColor="#3653BA"/></linearGradient>
        <radialGradient id="ethSheen2" cx="50%" cy="0%" r="65%"><stop offset="0%" stopColor="#fff" stopOpacity=".55"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#ethBg2)"/>
      <circle cx="12" cy="12" r="11" fill="url(#ethSheen2)"/>
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth=".4"/>
      <circle cx="12" cy="12" r="11" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth=".4"/>
      <g style={{ filter: 'drop-shadow(0 .5px .5px rgba(0,0,0,.25))' }}>
        <path fill="#fff" fillOpacity=".75" d="M12 4.5v5.18l4.62 2.07z"/>
        <path fill="#fff" d="M12 4.5L7.38 11.75 12 9.68z"/>
        <path fill="#fff" fillOpacity=".75" d="M12 15.74v3.76l4.62-6.4z"/>
        <path fill="#fff" d="M12 19.5v-3.77L7.38 13.1z"/>
        <path fill="#fff" fillOpacity=".4" d="M12 14.85l4.62-2.73L12 10.05z"/>
        <path fill="#fff" fillOpacity=".75" d="M7.38 12.12L12 14.85v-4.8z"/>
      </g>
    </svg>
  )
  if (k === 'usdt' || k === 'tether') return (
    <svg className={className} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="usdtBg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5BD4A6"/><stop offset="55%" stopColor="#26A17B"/><stop offset="100%" stopColor="#15694F"/></linearGradient>
        <radialGradient id="usdtSheen2" cx="50%" cy="0%" r="65%"><stop offset="0%" stopColor="#fff" stopOpacity=".55"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#usdtBg2)"/>
      <circle cx="12" cy="12" r="11" fill="url(#usdtSheen2)"/>
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth=".4"/>
      <circle cx="12" cy="12" r="11" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth=".4"/>
      <g style={{ filter: 'drop-shadow(0 .5px .5px rgba(0,0,0,.25))' }}>
        <path fill="#fff" d="M13.45 12.83v-1.7h3.31V8.55H7.24v2.58H10.55v1.7c-2.69.13-4.71.66-4.71 1.3 0 .64 2.02 1.17 4.71 1.3v5.45h2.9v-5.45c2.69-.13 4.71-.66 4.71-1.3 0-.64-2.02-1.17-4.71-1.3zm0 2.21q-.1.01-1.25.02c-.65 0-1.11-.02-1.27-.02-2.52-.11-4.4-.55-4.4-1.07 0-.53 1.88-.97 4.4-1.08v1.72c.17.01.65.04 1.28.04.78 0 1.16-.03 1.24-.04v-1.72c2.51.11 4.39.55 4.39 1.08 0 .53-1.88.96-4.39 1.07z"/>
      </g>
    </svg>
  )
  if (k === 'ltc' || k === 'litecoin') return (
    <svg className={className} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="ltcBg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#88A6D8"/><stop offset="55%" stopColor="#345D9D"/><stop offset="100%" stopColor="#1A3568"/></linearGradient>
        <radialGradient id="ltcSheen2" cx="50%" cy="0%" r="65%"><stop offset="0%" stopColor="#fff" stopOpacity=".55"/><stop offset="100%" stopColor="#fff" stopOpacity="0"/></radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#ltcBg2)"/>
      <circle cx="12" cy="12" r="11" fill="url(#ltcSheen2)"/>
      <circle cx="12" cy="12" r="10.6" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth=".4"/>
      <circle cx="12" cy="12" r="11" fill="none" stroke="#000" strokeOpacity=".18" strokeWidth=".4"/>
      <g style={{ filter: 'drop-shadow(0 .5px .5px rgba(0,0,0,.25))' }}>
        <path fill="#fff" d="M9.55 17.65l1.13-4.27 1.92-.7.46-1.74-.01-.04-1.89.69L12.5 6.5h-3.74l-1.78 6.74-1.46.54-.45 1.72 1.45-.54-1.04 3.92h11.88l.79-3.22z"/>
      </g>
    </svg>
  )
  if (k === 'rich' || k === 'diamond' || k === 'gem' || k === 'hexagon') return (
    <svg className={className} viewBox="2 2 20 20" fill="currentColor"><path d="M2.047 14.668a.994.994 0 0 0 .465.607l1.91 1.104v2.199a1 1 0 0 0 1 1h2.199l1.104 1.91a1.01 1.01 0 0 0 .866.5c.174 0 .347-.046.501-.135L12 20.75l1.91 1.104a1.001 1.001 0 0 0 1.366-.365l1.103-1.91h2.199a1 1 0 0 0 1-1V16.38l1.91-1.104a1 1 0 0 0 .365-1.367L20.75 12l1.104-1.908a1 1 0 0 0-.365-1.366l-1.91-1.104v-2.2a1 1 0 0 0-1-1H16.38l-1.103-1.909a1.008 1.008 0 0 0-.607-.466a.993.993 0 0 0-.759.1L12 3.25l-1.909-1.104a1 1 0 0 0-1.366.365l-1.104 1.91H5.422a1 1 0 0 0-1 1V7.62l-1.91 1.104a1.003 1.003 0 0 0-.365 1.368L3.251 12l-1.104 1.908a1.009 1.009 0 0 0-.1.76zM12 13c-3.48 0-4-1.879-4-3c0-1.287 1.029-2.583 3-2.915V6.012h2v1.109c1.734.41 2.4 1.853 2.4 2.879h-1l-1 .018C13.386 9.638 13.185 9 12 9c-1.299 0-2 .515-2 1c0 .374 0 1 2 1c3.48 0 4 1.879 4 3c0 1.287-1.029 2.583-3 2.915V18h-2v-1.08c-2.339-.367-3-2.003-3-2.92h2c.011.143.159 1 2 1c1.38 0 2-.585 2-1c0-.325 0-1-2-1z"/></svg>
  )
  if (k === 'inviter' || k === 'invite' || k === 'send' || k === 'user-plus' || k === 'flame' || k === 'fire') return (
    <svg className={className} viewBox="3 2.5 18 18.5" fill="currentColor"><path d="M17.66 11.2c-.23-.3-.51-.56-.77-.82c-.67-.6-1.43-1.03-2.07-1.66C13.33 7.26 13 4.85 13.95 3c-.95.23-1.78.75-2.49 1.32c-2.59 2.08-3.61 5.75-2.39 8.9c.04.1.08.2.08.33c0 .22-.15.42-.35.5c-.23.1-.47.04-.66-.12a.58.58 0 0 1-.14-.17c-1.13-1.43-1.31-3.48-.55-5.12C5.78 10 4.87 12.3 5 14.47c.06.5.12 1 .29 1.5c.14.6.41 1.2.71 1.73c1.08 1.73 2.95 2.97 4.96 3.22c2.14.27 4.43-.12 6.07-1.6c1.83-1.66 2.47-4.32 1.53-6.6l-.13-.26c-.21-.46-.77-1.26-.77-1.26m-3.16 6.3c-.28.24-.74.5-1.1.6c-1.12.4-2.24-.16-2.9-.82c1.19-.28 1.9-1.16 2.11-2.05c.17-.8-.15-1.46-.28-2.23c-.12-.74-.1-1.37.17-2.06c.19.38.39.76.63 1.06c.77 1 1.98 1.44 2.24 2.8c.04.14.06.28.06.43c.03.82-.33 1.72-.93 2.27Z"/></svg>
  )
  if (k === 'liked' || k === 'likes' || k === 'heart') return (
    <svg className={className} viewBox="0 0 640 640" fill="currentColor"><path d="M305 151.1L320 171.8L335 151.1C360 116.5 400.2 96 442.9 96C516.4 96 576 155.6 576 229.1L576 231.7C576 343.9 436.1 474.2 363.1 529.9C350.7 539.3 335.5 544 320 544C304.5 544 289.2 539.4 276.9 529.9C203.9 474.2 64 343.9 64 231.7L64 229.1C64 155.6 123.6 96 197.1 96C239.8 96 280 116.5 305 151.1z"/></svg>
  )
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
  )
}

interface BadgeSettings {
  show_badges: boolean
  badges_next_to_name: boolean
  glow_badges: boolean
  badge_color: string
  monochrome_badges: boolean
  badge_glow_strength: number
  badge_accent_color: string
  badge_border_radius: number
  badge_opacity: number
  badge_border_enabled: boolean
  badge_border_color: string
  badge_border_width: number
  badge_border_opacity: number
}

function fromProfile(p: any): BadgeSettings {
  return {
    show_badges: p.show_badges ?? true,
    badges_next_to_name: p.badges_next_to_name ?? false,
    glow_badges: p.glow_badges ?? false,
    badge_color: p.badge_color || '#ffffff',
    monochrome_badges: p.monochrome_badges ?? false,
    badge_glow_strength: p.badge_glow_strength ?? 50,
    badge_accent_color: p.badge_accent_color || '#ffffff',
    badge_border_radius: p.badge_border_radius ?? 50,
    badge_opacity: p.badge_opacity ?? 100,
    badge_border_enabled: p.badge_border_enabled ?? false,
    badge_border_color: p.badge_border_color || '#ffffff',
    badge_border_width: p.badge_border_width ?? 1,
    badge_border_opacity: p.badge_border_opacity ?? 100,
  }
}

export default function BadgesClient({ badges, profile, ownedBadgeIds = [], equippedBadgeIds = [] }: { badges: Badge[]; profile: Profile; ownedBadgeIds?: string[]; equippedBadgeIds?: string[] }) {
  const [claimOpen, setClaimOpen] = useState<Badge | null>(null)
  const [form, setForm] = useState<BadgeSettings>(() => fromProfile(profile))
  const saved = useRef<BadgeSettings>(fromProfile(profile))
  const [saving, setSaving] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const patch = useCallback((u: Partial<BadgeSettings>) => setForm((p) => ({ ...p, ...u })), [])
  const dirty = JSON.stringify(form) !== JSON.stringify(saved.current)

  const [equipped, setEquipped] = useState<Set<string>>(new Set(equippedBadgeIds))
  const owned = new Set(ownedBadgeIds)

  async function toggleEquip(badge: Badge) {
    const next = new Set(equipped)
    if (next.has(badge.id)) next.delete(badge.id); else next.add(badge.id)
    setEquipped(next)

    // Owner-only crypto badges - persist hidden slugs to profile column
    // instead of using the regular loadout table.
    if (badge.id.startsWith('rez-crypto-')) {
      const slug = badge.id.replace('rez-crypto-', '')
      const cryptoSlugs = ['btc', 'eth', 'usdt', 'ltc']
      const hidden = cryptoSlugs.filter((s) => !next.has(`rez-crypto-${s}`))
      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rez_unequipped_crypto: hidden }),
        })
        if (!res.ok) throw new Error()
        toast.success(next.has(badge.id) ? `Equipped ${badge.name}` : `Unequipped ${badge.name}`)
      } catch {
        setEquipped(equipped)
        toast.error('Failed to save')
      }
      return
    }

    try {
      const ids = Array.from(next).filter((id) => !id.startsWith('rez-crypto-'))
      const res = await fetch('/api/profile/loadout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badges: ids.map((id, i) => ({ badge_id: id, position: 'below_username', display_order: i })) }),
      })
      if (!res.ok) throw new Error()
      toast.success(next.has(badge.id) ? `Equipped ${badge.name}` : `Unequipped ${badge.name}`)
    } catch {
      // rollback
      setEquipped(equipped)
      toast.error('Failed to save')
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      saved.current = { ...form }
      toast.success('Badge settings saved!')
    } catch { toast.error('Failed to save') } finally { setSaving(false) }
  }

  const isExclusive = (b: Badge) => /^(owner|staff|og)$/i.test(b.name)
  // Rank badges (#1/#2/#3 Ranked) are auto-awarded by the leaderboard cron,
  // never manually claimed - show a "get to the top" hint instead of Claim.
  const isRankBadge = (b: Badge) => /^#[123] Ranked$/.test(b.name)
  // The Liked badge is auto-earned at 10 profile likes - its claim popup shows
  // the milestone instead of the manual "DM @38fx" flow.
  const isMilestoneBadge = (b: Badge) => b.name === 'Liked'

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Badges</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse all badges available on halo.rip and claim the ones you've earned.</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)' }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-accent-soft">
            <IconAward className="size-4 text-primary" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">All Badges</h2>
          <span className="ml-auto text-xs text-muted-foreground/70">{badges.length} total</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge) => {
            const exclusive = isExclusive(badge)
            const color = badge.color || '#ffffff'
            const glow = badge.glow_color || color
            const isOwned = owned.has(badge.id)
            const isEquipped = equipped.has(badge.id)

            return (
              <div
                key={badge.id}
                className={`group relative flex items-center gap-3 rounded-xl border bg-surface-2 p-3 transition-all hover:-translate-y-0.5 ${isOwned ? 'border-border-strong' : 'border-border hover:border-border-strong'}`}
                style={{
                  boxShadow: isOwned
                    ? `0 1px 0 rgba(255,255,255,0.04) inset, 0 6px 22px -8px ${glow}55, 0 0 0 1px ${glow}22`
                    : '0 1px 0 rgba(255,255,255,0.04) inset, 0 6px 18px -10px rgba(0,0,0,0.5)',
                }}
              >
                {/* icon tile - extra glow when owned. If the badge has an
                    uploaded `icon_url` (custom image), prefer that over the
                    Lucide identifier in `icon`. Matches what the public
                    profile renderer does in guns-profile.tsx. */}
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
                  style={{
                    color,
                    borderColor: isOwned ? `${glow}55` : `${glow}25`,
                    background: isOwned ? `linear-gradient(135deg, ${glow}33, ${glow}10)` : `linear-gradient(135deg, ${glow}1c, ${glow}05)`,
                    boxShadow: isOwned ? `inset 0 1px 0 ${glow}30, 0 0 14px ${glow}55` : `inset 0 1px 0 ${glow}20`,
                  }}
                >
                  {badge.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={badge.icon_url}
                      alt=""
                      className="h-7 w-7 object-contain"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <BadgeIcon name={badge.icon || badge.name} className="h-5 w-5" />
                  )}
                </span>

                {/* name + desc */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{badge.name}</p>
                  {badge.description ? (
                    <p className="truncate text-[11px] text-muted-foreground">{badge.description}</p>
                  ) : null}
                </div>

                {/* action */}
                {exclusive && !isOwned ? (
                  <span className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    Restricted
                  </span>
                ) : isRankBadge(badge) && !isOwned ? (
                  <span className="shrink-0 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-center text-[11px] font-medium text-muted-foreground">
                    Get to {badge.name.replace(' Ranked', '')}
                  </span>
                ) : isOwned ? (
                  <button
                    type="button"
                    onClick={() => toggleEquip(badge)}
                    className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    style={{
                      color: isEquipped ? '#0b0b10' : color,
                      borderColor: `${glow}55`,
                      background: isEquipped
                        ? `linear-gradient(180deg, ${glow}, ${glow}cc)`
                        : `linear-gradient(180deg, ${glow}1a, ${glow}08)`,
                      boxShadow: isEquipped ? `0 0 12px ${glow}80` : undefined,
                    }}
                  >
                    {isEquipped ? 'Equipped' : 'Equip'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setClaimOpen(badge)}
                    className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                    style={{
                      color,
                      borderColor: `${glow}40`,
                      background: `linear-gradient(180deg, ${glow}1a, ${glow}08)`,
                    }}
                  >
                    Claim
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── Badge Settings ─── */}
      <div
        className="rounded-2xl border border-border bg-surface p-5"
        style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)' }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/15 bg-accent-soft">
            <IconAdjustments className="size-4 text-primary" />
          </span>
          <h2 className="text-lg font-semibold text-foreground">Badge Settings</h2>
        </div>

        {/* Display toggles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Show Badges</p>
              <p className="text-[11px] text-muted-foreground">Display badges on your profile</p>
            </div>
            <Switch checked={form.show_badges} onCheckedChange={(v) => patch({ show_badges: v })} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Badges Next To Name</p>
              <p className="text-[11px] text-muted-foreground">Inline beside display name</p>
            </div>
            <Switch checked={form.badges_next_to_name} onCheckedChange={(v) => patch({ badges_next_to_name: v })} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Glow Badges</p>
              <p className="text-[11px] text-muted-foreground">Add a halo around each badge</p>
            </div>
            <Switch checked={form.glow_badges} onCheckedChange={(v) => patch({ glow_badges: v })} />
          </label>
        </div>

        {/* Color + monochrome */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground-secondary">Badge Color</span>
              <button onClick={() => patch({ badge_color: '#ffffff' })} className="text-muted-foreground/70 hover:text-foreground-secondary"><IconRotate2 className="size-3.5" /></button>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-2 pr-3">
              <input type="color" value={form.badge_color} onChange={(e) => patch({ badge_color: e.target.value })} className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0.5" />
              <input type="text" value={form.badge_color} onChange={(e) => patch({ badge_color: e.target.value })} className="flex-1 bg-transparent text-sm text-foreground outline-none font-mono" />
            </div>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4">
            <div className="py-3">
              <p className="text-sm font-medium text-foreground">Monochrome</p>
              <p className="text-[11px] text-muted-foreground">All badges use Badge Color</p>
            </div>
            <Switch checked={form.monochrome_badges} onCheckedChange={(v) => patch({ monochrome_badges: v })} />
          </label>
        </div>

        {/* Glow strength */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground-secondary">Badge Glow Strength <span className="ml-1 text-xs text-muted-foreground">{form.badge_glow_strength}%</span></span>
            <button onClick={() => patch({ badge_glow_strength: 50 })} className="text-muted-foreground/70 hover:text-foreground-secondary"><IconRotate2 className="size-3.5" /></button>
          </div>
          <input type="range" min={0} max={100} value={form.badge_glow_strength} onChange={(e) => patch({ badge_glow_strength: Number(e.target.value) })} className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary" />
        </div>

        {/* Advanced toggle */}
        <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="mt-5 flex w-full items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-foreground-secondary hover:bg-surface-3">
          <span className="flex items-center gap-2"><IconPalette className="size-4 text-primary" /> Advanced (radius, opacity, border)</span>
          <span className={`text-muted-foreground transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>›</span>
        </button>

        {showAdvanced ? (
          <div className="mt-3 space-y-4 rounded-xl border border-border bg-surface-2 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground-secondary">Border Radius <span className="ml-1 text-xs text-muted-foreground">{form.badge_border_radius}px</span></span>
                  <button onClick={() => patch({ badge_border_radius: 50 })} className="text-muted-foreground/70"><IconRotate2 className="size-3.5" /></button>
                </div>
                <input type="range" min={0} max={50} value={form.badge_border_radius} onChange={(e) => patch({ badge_border_radius: Number(e.target.value) })} className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary" />
              </div>
              {/* Opacity slider removed - the Disable Background toggle
                  below now drives badge_opacity directly (0 when on,
                  100 when off). One control instead of two for the
                  same underlying setting. */}
            </div>
            <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Disable Background</p>
                <p className="text-[11px] text-muted-foreground">Show only the icon, no background pill</p>
              </div>
              {/* Single source of truth: this toggle flips badge_opacity
                  between 0 (off) and 100 (on). The old standalone Opacity
                  slider was confusing because users had two controls
                  for the same underlying value. */}
              <Switch checked={form.badge_opacity === 0} onCheckedChange={(v) => patch({ badge_opacity: v ? 0 : 100 })} />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Badge Border</p>
                <p className="text-[11px] text-muted-foreground">Draw a border around each badge</p>
              </div>
              <Switch checked={form.badge_border_enabled} onCheckedChange={(v) => patch({ badge_border_enabled: v })} />
            </label>
            {form.badge_border_enabled ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <div className="mb-1.5 text-xs font-medium text-foreground-secondary">Border Color</div>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-2 pr-3">
                    <input type="color" value={form.badge_border_color} onChange={(e) => patch({ badge_border_color: e.target.value })} className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0.5" />
                    <input type="text" value={form.badge_border_color} onChange={(e) => patch({ badge_border_color: e.target.value })} className="flex-1 bg-transparent text-xs text-foreground outline-none font-mono" />
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-foreground-secondary">Width <span className="ml-1 text-[10px] text-muted-foreground">{form.badge_border_width}px</span></div>
                  <input type="range" min={1} max={8} value={form.badge_border_width} onChange={(e) => patch({ badge_border_width: Number(e.target.value) })} className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary" />
                </div>
                <div>
                  <div className="mb-1.5 text-xs font-medium text-foreground-secondary">Border Opacity <span className="ml-1 text-[10px] text-muted-foreground">{form.badge_border_opacity}%</span></div>
                  <input type="range" min={0} max={100} value={form.badge_border_opacity} onChange={(e) => patch({ badge_border_opacity: Number(e.target.value) })} className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary" />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Floating save bar */}
      {dirty ? (
        <div className="fixed bottom-0 left-0 right-0 z-[100] animate-in slide-in-from-bottom-6 fade-in duration-500">
          <div className="mx-auto max-w-3xl px-4 pb-4">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border-strong bg-surface/90 px-5 py-3 backdrop-blur-2xl" style={{ boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 24px 48px -16px rgba(0,0,0,0.7)' }}>
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                  <span className="relative h-2 w-2 rounded-full bg-primary" />
                </span>
                Unsaved changes
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm(saved.current)} disabled={saving} className="rounded-lg px-3 py-1.5 text-sm text-foreground-secondary hover:bg-white/[0.05] hover:text-foreground">Reset</button>
                <button type="button" onClick={handleSave} disabled={saving} className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                  {saving ? <><IconLoader2 className="size-3.5 animate-spin" /> Saving</> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Claim popup */}
      <Dialog open={!!claimOpen} onOpenChange={(o) => !o && setClaimOpen(null)}>
        <DialogContent className="border-border bg-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {claimOpen ? (
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{
                    color: claimOpen.color || '#fff',
                    background: `${(claimOpen.glow_color || claimOpen.color || '#fff')}1a`,
                    filter: `drop-shadow(0 0 6px ${(claimOpen.glow_color || claimOpen.color || '#fff')}aa)`,
                  }}
                >
                  <BadgeIcon name={claimOpen.icon || claimOpen.name} className="h-4 w-4" />
                </span>
              ) : null}
              Claim {claimOpen?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {claimOpen && isMilestoneBadge(claimOpen) ? (
              <p className="text-sm text-foreground-secondary">
                Get <span className="font-semibold text-foreground">10 likes</span> on your profile. Awarded automatically, removed if you drop below.
              </p>
            ) : (
              <>
                <p className="text-sm text-foreground-secondary">
                  To claim this badge, please DM{' '}
                  <a
                    href="https://discord.com/users/823227411721093142"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary hover:underline"
                  >
                    @38fx
                  </a>{' '}
                  on Discord with proof you've earned it.
                </p>
                <div className="rounded-xl border border-border bg-surface-2 p-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Tip:</span> include screenshots, a link to your profile, and which badge you're claiming so it gets reviewed faster.
                  </p>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setClaimOpen(null)}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
